namespace ApiCore.Models;

public class DoctorLeave
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }
    public DateOnly LeaveDate { get; set; }
    public string? Reason { get; set; }
}
