namespace ApiCore.Models;

public enum UserRole { Patient, Doctor, Admin }

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public UserRole Role { get; set; }
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DoctorProfile? DoctorProfile { get; set; }
}
