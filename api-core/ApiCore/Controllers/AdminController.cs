using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiCore.Data;
using ApiCore.Models;
using ApiCore.Services;

namespace ApiCore.Controllers;

public record CreateUserRequest(string Email, string Password, string Name, string? Phone, string Role);
public record UpsertDoctorProfileRequest(
    string Specialization,
    string? Bio,
    string WorkingHoursJson,
    int SlotDurationMinutes);
public record MarkLeaveRequest(DateOnly LeaveDate, string? Reason);

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuthService _auth;
    private readonly AiServiceClient _ai;
    private readonly GoogleCalendarService _calendar;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        AppDbContext db, AuthService auth, AiServiceClient ai,
        GoogleCalendarService calendar, ILogger<AdminController> logger)
    {
        _db = db;
        _auth = auth;
        _ai = ai;
        _calendar = calendar;
        _logger = logger;
    }

    // POST /api/admin/users — create Doctor or Admin accounts
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateUserRequest req)
    {
        if (!Enum.TryParse<UserRole>(req.Role, true, out var role))
            return BadRequest(new { error = "Invalid role. Valid values: Doctor, Admin." });

        if (role == UserRole.Patient)
            return BadRequest(new { error = "Patients self-register via /api/auth/register." });

        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict(new { error = "Email already registered." });

        var user = new User
        {
            Email = req.Email,
            PasswordHash = _auth.HashPassword(req.Password),
            Name = req.Name,
            Phone = req.Phone,
            Role = role
        };

        _db.Users.Add(user);

        if (role == UserRole.Doctor)
        {
            _db.DoctorProfiles.Add(new DoctorProfile
            {
                UserId = user.Id,
                Specialization = "General Practice",
                WorkingHoursJson = "{}",
                SlotDurationMinutes = 20
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.Email, user.Name, user.Role });
    }

    // GET /api/admin/doctors — list all doctor profiles
    [HttpGet("doctors")]
    public async Task<IActionResult> ListDoctors()
    {
        var doctors = await _db.DoctorProfiles
            .Include(d => d.User)
            .Select(d => new
            {
                d.Id,
                d.UserId,
                Name = d.User.Name,
                Email = d.User.Email,
                d.Specialization,
                d.Bio,
                d.WorkingHoursJson,
                d.SlotDurationMinutes
            })
            .ToListAsync();

        return Ok(doctors);
    }

    // GET /api/admin/doctors/:profileId — get single doctor profile
    [HttpGet("doctors/{profileId:guid}")]
    public async Task<IActionResult> GetDoctorProfile(Guid profileId)
    {
        var profile = await _db.DoctorProfiles
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == profileId);

        if (profile is null) return NotFound(new { error = "Doctor profile not found." });

        return Ok(new
        {
            profile.Id,
            profile.UserId,
            Name = profile.User.Name,
            profile.Specialization,
            profile.Bio,
            profile.WorkingHoursJson,
            profile.SlotDurationMinutes
        });
    }

    // POST /api/admin/doctors/:id — create/update DoctorProfile for a user
    [HttpPost("doctors/{userId:guid}")]
    public async Task<IActionResult> UpsertDoctorProfile(Guid userId, UpsertDoctorProfileRequest req)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound(new { error = "User not found." });
        if (user.Role != UserRole.Doctor)
            return BadRequest(new { error = "User is not a Doctor." });

        var profile = await _db.DoctorProfiles.FirstOrDefaultAsync(d => d.UserId == userId);
        if (profile is null)
        {
            profile = new DoctorProfile { UserId = userId };
            _db.DoctorProfiles.Add(profile);
        }

        profile.Specialization = req.Specialization;
        profile.Bio = req.Bio;
        profile.WorkingHoursJson = req.WorkingHoursJson;
        profile.SlotDurationMinutes = req.SlotDurationMinutes;

        await _db.SaveChangesAsync();
        return Ok(new { profile.Id, profile.UserId, profile.Specialization });
    }

    // PUT /api/admin/doctors/:id — update DoctorProfile by profile ID
    [HttpPut("doctors/{profileId:guid}")]
    public async Task<IActionResult> UpdateDoctorProfile(Guid profileId, UpsertDoctorProfileRequest req)
    {
        var profile = await _db.DoctorProfiles.FindAsync(profileId);
        if (profile is null) return NotFound(new { error = "Doctor profile not found." });

        profile.Specialization = req.Specialization;
        profile.Bio = req.Bio;
        profile.WorkingHoursJson = req.WorkingHoursJson;
        profile.SlotDurationMinutes = req.SlotDurationMinutes;

        await _db.SaveChangesAsync();
        return Ok(new { profile.Id, profile.Specialization });
    }

    // POST /api/admin/doctors/:id/leave — mark leave, cascade-cancel appointments
    [HttpPost("doctors/{profileId:guid}/leave")]
    public async Task<IActionResult> MarkLeave(Guid profileId, MarkLeaveRequest req)
    {
        var profile = await _db.DoctorProfiles.FindAsync(profileId);
        if (profile is null) return NotFound(new { error = "Doctor profile not found." });

        List<Guid> cancelledIds;

        await using (var tx = await _db.Database.BeginTransactionAsync())
        {
            // Insert leave record
            var leave = new DoctorLeave
            {
                DoctorId = profileId,
                LeaveDate = req.LeaveDate,
                Reason = req.Reason
            };
            _db.DoctorLeaves.Add(leave);

            // Find and cancel all Confirmed appointments on that date
            var dayStart = req.LeaveDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var dayEnd = dayStart.AddDays(1);

            var affected = await _db.Appointments
                .Where(a => a.DoctorId == profileId
                    && a.Status == AppointmentStatus.Confirmed
                    && a.SlotStart >= dayStart
                    && a.SlotStart < dayEnd)
                .ToListAsync();

            foreach (var appt in affected)
            {
                appt.Status = AppointmentStatus.LeaveCancelled;
                appt.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            cancelledIds = affected.Select(a => a.Id).ToList();
        }

        // After commit: fire-and-forget calendar deletions and patient notifications
        if (cancelledIds.Count > 0)
        {
            _ = Task.Run(async () =>
            {
                foreach (var apptId in cancelledIds)
                {
                    var appt = await _db.Appointments.FindAsync(apptId);
                    if (appt != null)
                        await _calendar.DeleteEventAsync(appt.PatientCalendarEventId);
                }
            });

            _ai.FireAndForgetNotifyLeaveCancellation(cancelledIds);
        }

        return Ok(new
        {
            profileId,
            leaveDate = req.LeaveDate,
            appointmentsCancelled = cancelledIds.Count,
            cancelledAppointmentIds = cancelledIds
        });
    }
}
