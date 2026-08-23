namespace ApiCore.Models;

public enum AppointmentStatus { Confirmed, Cancelled, Completed, LeaveCancelled }

public class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public User? Patient { get; set; }
    public Guid DoctorId { get; set; }
    public DoctorProfile? Doctor { get; set; }
    public DateTime SlotStart { get; set; }
    public DateTime SlotEnd { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Confirmed;

    public string? SymptomText { get; set; }
    public string? PreVisitSummaryJson { get; set; }
    public string PreVisitLlmStatus { get; set; } = "PENDING";

    public string? PostVisitNotes { get; set; }
    public string? PostVisitSummaryJson { get; set; }
    public string PostVisitLlmStatus { get; set; } = "PENDING";

    public string? PatientCalendarEventId { get; set; }
    public string? DoctorCalendarEventId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();
}
