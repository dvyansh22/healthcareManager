namespace ApiCore.Models;

public class DoctorProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public string Specialization { get; set; } = default!;
    public string? Bio { get; set; }
    // JSON string: {"mon":{"start":"09:00","end":"17:00"}, ...}
    public string WorkingHoursJson { get; set; } = "{}";
    public int SlotDurationMinutes { get; set; } = 20;

    public ICollection<DoctorLeave> Leaves { get; set; } = new List<DoctorLeave>();
}
