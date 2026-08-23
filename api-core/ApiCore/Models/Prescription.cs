namespace ApiCore.Models;

public class Prescription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AppointmentId { get; set; }
    public string MedicationName { get; set; } = default!;
    public string? Dosage { get; set; }
    public int FrequencyPerDay { get; set; }
    public int DurationDays { get; set; }
    public DateOnly StartDate { get; set; }
}
