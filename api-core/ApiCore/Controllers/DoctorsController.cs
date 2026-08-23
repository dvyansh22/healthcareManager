using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiCore.Data;

namespace ApiCore.Controllers;

[ApiController]
[Route("api/doctors")]
public class DoctorsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DoctorsController(AppDbContext db) => _db = db;

    // GET /api/doctors?specialization=
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? specialization)
    {
        var query = _db.DoctorProfiles
            .Include(d => d.User)
            .Where(d => d.User != null);

        if (!string.IsNullOrWhiteSpace(specialization))
            query = query.Where(d => d.Specialization.ToLower().Contains(specialization.ToLower()));

        var doctors = await query
            .Select(d => new
            {
                d.Id,
                d.UserId,
                d.Specialization,
                d.Bio,
                d.SlotDurationMinutes,
                Name = d.User.Name,
                Email = d.User.Email
            })
            .ToListAsync();

        return Ok(doctors);
    }

    // GET /api/doctors/:id/availability?date=YYYY-MM-DD
    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> Availability(Guid id, [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var targetDate))
            return BadRequest(new { error = "Invalid date format. Use YYYY-MM-DD." });

        var profile = await _db.DoctorProfiles
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (profile is null) return NotFound(new { error = "Doctor not found." });

        // Check leave
        var isOnLeave = await _db.DoctorLeaves
            .AnyAsync(l => l.DoctorId == id && l.LeaveDate == targetDate);

        if (isOnLeave)
            return Ok(new { date, slots = Array.Empty<object>(), message = "Doctor is on leave this day." });

        // Parse working hours JSON
        var dayKey = targetDate.DayOfWeek.ToString()[..3].ToLower(); // "mon","tue",...
        var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var workingHours = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, WorkingHoursEntry>>(
            profile.WorkingHoursJson ?? "{}", jsonOptions)
            ?? new Dictionary<string, WorkingHoursEntry>();


        if (!workingHours.TryGetValue(dayKey, out var hours))
            return Ok(new { date, slots = Array.Empty<object>(), message = "Doctor does not work on this day." });

        var startTime = TimeOnly.Parse(hours.Start);
        var endTime = TimeOnly.Parse(hours.End);
        var slotDuration = TimeSpan.FromMinutes(profile.SlotDurationMinutes);

        // Generate all theoretical slots
        var allSlots = new List<DateTime>();
        var current = targetDate.ToDateTime(startTime, DateTimeKind.Utc);
        var dayEnd = targetDate.ToDateTime(endTime, DateTimeKind.Utc);

        while (current.Add(slotDuration) <= dayEnd)
        {
            allSlots.Add(current);
            current = current.Add(slotDuration);
        }

        // Fetch occupied slots (active holds + confirmed appointments)
        var slotStartsUtc = allSlots;
        var heldSlots = await _db.SlotHolds
            .Where(h => h.DoctorId == id && h.ExpiresAt > DateTime.UtcNow
                && slotStartsUtc.Contains(h.SlotStart))
            .Select(h => h.SlotStart)
            .ToListAsync();

        var bookedSlots = await _db.Appointments
            .Where(a => a.DoctorId == id
                && a.Status != ApiCore.Models.AppointmentStatus.Cancelled
                && a.Status != ApiCore.Models.AppointmentStatus.LeaveCancelled
                && slotStartsUtc.Contains(a.SlotStart))
            .Select(a => a.SlotStart)
            .ToListAsync();

        var occupiedSet = new HashSet<DateTime>(heldSlots.Concat(bookedSlots));

        var freeSlots = allSlots
            .Where(s => !occupiedSet.Contains(s))
            .Select(s => new
            {
                slotStart = s,
                slotEnd = s.Add(slotDuration)
            })
            .ToList();

        return Ok(new { date, slots = freeSlots });
    }

    public record UpdateProfileRequest(string? Specialization, string? Bio, int? SlotDurationMinutes, string? WorkingHoursJson);

    // GET /api/doctors/me
    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Doctor")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdStr == null) return Unauthorized();
        var userId = Guid.Parse(userIdStr);
        
        var profile = await _db.DoctorProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null) return NotFound(new { error = "Profile not found" });
        return Ok(profile);
    }

    // PUT /api/doctors/me
    [HttpPut("me")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Doctor")]
    public async Task<IActionResult> UpdateMyProfile(UpdateProfileRequest req)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdStr == null) return Unauthorized();
        var userId = Guid.Parse(userIdStr);
        
        var profile = await _db.DoctorProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null) return NotFound(new { error = "Profile not found" });

        if (req.Specialization != null) profile.Specialization = req.Specialization;
        if (req.Bio != null) profile.Bio = req.Bio;
        if (req.SlotDurationMinutes.HasValue) profile.SlotDurationMinutes = req.SlotDurationMinutes.Value;
        if (req.WorkingHoursJson != null) profile.WorkingHoursJson = req.WorkingHoursJson;

        await _db.SaveChangesAsync();
        return Ok(profile);
    }

    private record WorkingHoursEntry(string Start, string End);
}
