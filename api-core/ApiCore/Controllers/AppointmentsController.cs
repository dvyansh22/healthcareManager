using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiCore.Data;
using ApiCore.Models;
using ApiCore.Services;

namespace ApiCore.Controllers;

public record HoldRequest(Guid DoctorId, DateTime SlotStart);
public record ConfirmRequest(Guid HoldId, string? SymptomText);
public record SubmitNotesRequest(
    string ClinicalNotes,
    List<PrescriptionInput> Prescriptions);
public record PrescriptionInput(
    string MedicationName,
    string? Dosage,
    int FrequencyPerDay,
    int DurationDays,
    DateOnly StartDate);

[ApiController]
[Route("api/appointments")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AiServiceClient _ai;
    private readonly GoogleCalendarService _calendar;

    public AppointmentsController(AppDbContext db, AiServiceClient ai, GoogleCalendarService calendar)
    {
        _db = db;
        _ai = ai;
        _calendar = calendar;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string CurrentRole =>
        User.FindFirstValue(ClaimTypes.Role)!;

    // POST /api/appointments/hold
    [HttpPost("hold")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> Hold(HoldRequest req)
    {
        var profile = await _db.DoctorProfiles.FindAsync(req.DoctorId);
        if (profile is null) return NotFound(new { error = "Doctor not found." });

        var slotStart = DateTime.SpecifyKind(req.SlotStart, DateTimeKind.Utc);
        var slotEnd = slotStart.AddMinutes(profile.SlotDurationMinutes);
        var expiresAt = DateTime.UtcNow.AddMinutes(10);

        var hold = new SlotHold
        {
            DoctorId = req.DoctorId,
            SlotStart = slotStart,
            SlotEnd = slotEnd,
            PatientId = CurrentUserId,
            ExpiresAt = expiresAt
        };

        _db.SlotHolds.Add(hold);
        try
        {
            await _db.SaveChangesAsync();
            return Ok(new { holdId = hold.Id, expiresAt });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Slot no longer available." });
        }
    }

    // POST /api/appointments/confirm
    [HttpPost("confirm")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> Confirm(ConfirmRequest req)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var hold = await _db.SlotHolds.FindAsync(req.HoldId);
        if (hold is null || hold.PatientId != CurrentUserId)
            return NotFound(new { error = "Hold not found." });
        if (hold.ExpiresAt < DateTime.UtcNow)
            return Conflict(new { error = "Hold has expired." });

        _db.SlotHolds.Remove(hold);

        var appt = new Appointment
        {
            PatientId = hold.PatientId,
            DoctorId = hold.DoctorId,
            SlotStart = hold.SlotStart,
            SlotEnd = hold.SlotEnd,
            SymptomText = req.SymptomText,
            Status = AppointmentStatus.Confirmed
        };

        _db.Appointments.Add(appt);
        try
        {
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync();
            return Conflict(new { error = "Slot was booked by someone else." });
        }

        // Post-transaction: call ai-service for pre-visit summary (~15s timeout)
        var summaryJson = await _ai.CallPreVisitAsync(appt.Id, req.SymptomText);
        appt.PreVisitSummaryJson = summaryJson;
        appt.PreVisitLlmStatus = "SUCCESS";
        await _db.SaveChangesAsync();

        // Google Calendar — fire-and-forget within async context
        _ = Task.Run(async () =>
        {
            var patient = await _db.Users.FindAsync(appt.PatientId);
            var doctor = await _db.Users
                .Include(u => u.DoctorProfile)
                .FirstOrDefaultAsync(u => u.DoctorProfile != null && u.DoctorProfile.Id == appt.DoctorId);

            if (patient != null && doctor != null)
            {
                var eventId = await _calendar.CreateAppointmentEventAsync(
                    appt, patient.Email, patient.Name, doctor.Email, doctor.Name);
                appt.PatientCalendarEventId = eventId;
                appt.DoctorCalendarEventId = eventId;
                await _db.SaveChangesAsync();
            }
        });

        // Notify ai-service — fire-and-forget
        _ai.FireAndForgetNotifyBookingConfirmed(appt.Id);

        return Ok(new { appointmentId = appt.Id, appt.SlotStart, appt.SlotEnd, appt.Status });
    }

    // GET /api/appointments/mine
    [HttpGet("mine")]
    public async Task<IActionResult> Mine()
    {
        var userId = CurrentUserId;
        var role = CurrentRole;

        var query = _db.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor!)
                .ThenInclude(d => d.User)
            .AsQueryable();

        if (role == "Patient")
            query = query.Where(a => a.PatientId == userId);
        else if (role == "Doctor")
        {
            var profile = await _db.DoctorProfiles.FirstOrDefaultAsync(d => d.UserId == userId);
            if (profile is null) return Ok(new List<object>());
            query = query.Where(a => a.DoctorId == profile.Id);
        }
        else
            return Forbid();

        var appts = await query
            .OrderByDescending(a => a.SlotStart)
            .ToListAsync();

        var result = appts.Select(a => new
        {
            a.Id,
            a.SlotStart,
            a.SlotEnd,
            a.Status,
            a.SymptomText,
            DoctorName = a.Doctor?.User?.Name,
            DoctorSpecialization = a.Doctor?.Specialization,
            PatientName = a.Patient?.Name,
            // Doctor sees pre-visit summary; patient does not
            PreVisitSummary = role == "Doctor" ? a.PreVisitSummaryJson : null,
            // Both can see post-visit summary once available
            PostVisitSummary = a.PostVisitSummaryJson,
            a.PostVisitLlmStatus,
            HasCalendarEvent = a.PatientCalendarEventId != null,
            a.CreatedAt
        });

        return Ok(result);
    }

    // POST /api/appointments/:id/cancel
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var userId = CurrentUserId;
        var role = CurrentRole;

        var appt = await _db.Appointments.FindAsync(id);
        if (appt is null) return NotFound(new { error = "Appointment not found." });

        // Ownership check
        if (role == "Patient" && appt.PatientId != userId)
            return Forbid();
        if (role == "Doctor")
        {
            var profile = await _db.DoctorProfiles.FirstOrDefaultAsync(d => d.UserId == userId);
            if (profile is null || appt.DoctorId != profile.Id) return Forbid();
        }

        if (appt.Status == AppointmentStatus.Cancelled || appt.Status == AppointmentStatus.LeaveCancelled)
            return BadRequest(new { error = "Appointment is already cancelled." });

        appt.Status = AppointmentStatus.Cancelled;
        appt.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Fire-and-forget: delete calendar event + notify
        var eventId = appt.PatientCalendarEventId;
        _ = Task.Run(async () => await _calendar.DeleteEventAsync(eventId));
        _ai.FireAndForgetNotifyCancellation(appt.Id);

        return Ok(new { appt.Id, appt.Status });
    }

    // POST /api/appointments/:id/notes  (Doctor only)
    [HttpPost("{id:guid}/notes")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> SubmitNotes(Guid id, SubmitNotesRequest req)
    {
        var userId = CurrentUserId;
        var profile = await _db.DoctorProfiles.FirstOrDefaultAsync(d => d.UserId == userId);
        if (profile is null) return Forbid();

        var appt = await _db.Appointments.FindAsync(id);
        if (appt is null) return NotFound(new { error = "Appointment not found." });
        if (appt.DoctorId != profile.Id) return Forbid();

        await using var tx = await _db.Database.BeginTransactionAsync();

        appt.PostVisitNotes = req.ClinicalNotes;
        appt.Status = AppointmentStatus.Completed;
        appt.UpdatedAt = DateTime.UtcNow;

        // Persist prescriptions
        foreach (var p in req.Prescriptions)
        {
            _db.Prescriptions.Add(new Prescription
            {
                AppointmentId = appt.Id,
                MedicationName = p.MedicationName,
                Dosage = p.Dosage,
                FrequencyPerDay = p.FrequencyPerDay,
                DurationDays = p.DurationDays,
                StartDate = p.StartDate
            });
        }

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        // Post-visit LLM summary
        var summaryJson = await _ai.CallPostVisitAsync(appt.Id, req.ClinicalNotes);
        appt.PostVisitSummaryJson = summaryJson;
        appt.PostVisitLlmStatus = "SUCCESS";
        await _db.SaveChangesAsync();

        // Fire-and-forget: schedule medication reminders
        _ai.FireAndForgetNotifyBookingCompleted(appt.Id);

        return Ok(new { appt.Id, appt.Status, postVisitSummary = appt.PostVisitSummaryJson });
    }
}
