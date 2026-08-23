using Microsoft.EntityFrameworkCore;
using ApiCore.Models;

namespace ApiCore.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<DoctorProfile> DoctorProfiles => Set<DoctorProfile>();
    public DbSet<DoctorLeave> DoctorLeaves => Set<DoctorLeave>();
    public DbSet<SlotHold> SlotHolds => Set<SlotHold>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<GoogleCalendarToken> GoogleCalendarTokens => Set<GoogleCalendarToken>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().ToTable("users", "core");
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();

        b.Entity<DoctorProfile>().ToTable("doctor_profiles", "core");
        b.Entity<DoctorProfile>()
            .HasOne(d => d.User).WithOne(u => u.DoctorProfile)
            .HasForeignKey<DoctorProfile>(d => d.UserId);

        b.Entity<DoctorLeave>().ToTable("doctor_leaves", "core");
        b.Entity<DoctorLeave>().HasIndex(l => new { l.DoctorId, l.LeaveDate }).IsUnique();

        b.Entity<SlotHold>().ToTable("slot_holds", "core");
        b.Entity<SlotHold>().HasIndex(h => new { h.DoctorId, h.SlotStart }).IsUnique();

        b.Entity<Appointment>().ToTable("appointments", "core");
        b.Entity<Appointment>()
            .Property(a => a.Status)
            .HasConversion<string>();
        b.Entity<Appointment>()
            .HasIndex(a => new { a.DoctorId, a.SlotStart })
            .IsUnique()
            .HasFilter("\"Status\" != 'Cancelled'");
        b.Entity<Appointment>()
            .HasOne(a => a.Patient)
            .WithMany()
            .HasForeignKey(a => a.PatientId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Appointment>()
            .HasOne(a => a.Doctor)
            .WithMany()
            .HasForeignKey(a => a.DoctorId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Prescription>().ToTable("prescriptions", "core");
        b.Entity<Prescription>()
            .HasOne<Appointment>()
            .WithMany(a => a.Prescriptions)
            .HasForeignKey(p => p.AppointmentId);


        b.Entity<GoogleCalendarToken>().ToTable("google_calendar_tokens", "core");
        b.Entity<GoogleCalendarToken>()
            .HasOne(t => t.User).WithOne()
            .HasForeignKey<GoogleCalendarToken>(t => t.UserId);
        b.Entity<GoogleCalendarToken>().HasIndex(t => t.UserId).IsUnique();
    }
}
