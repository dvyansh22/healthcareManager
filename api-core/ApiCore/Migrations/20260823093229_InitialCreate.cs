using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ApiCore.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "core");

            migrationBuilder.CreateTable(
                name: "appointments",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SlotEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    SymptomText = table.Column<string>(type: "text", nullable: true),
                    PreVisitSummaryJson = table.Column<string>(type: "text", nullable: true),
                    PreVisitLlmStatus = table.Column<string>(type: "text", nullable: false),
                    PostVisitNotes = table.Column<string>(type: "text", nullable: true),
                    PostVisitSummaryJson = table.Column<string>(type: "text", nullable: true),
                    PostVisitLlmStatus = table.Column<string>(type: "text", nullable: false),
                    PatientCalendarEventId = table.Column<string>(type: "text", nullable: true),
                    DoctorCalendarEventId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_appointments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "prescriptions",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicationName = table.Column<string>(type: "text", nullable: false),
                    Dosage = table.Column<string>(type: "text", nullable: true),
                    FrequencyPerDay = table.Column<int>(type: "integer", nullable: false),
                    DurationDays = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescriptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "slot_holds",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SlotEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_slot_holds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "doctor_profiles",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Specialization = table.Column<string>(type: "text", nullable: false),
                    Bio = table.Column<string>(type: "text", nullable: true),
                    WorkingHoursJson = table.Column<string>(type: "text", nullable: false),
                    SlotDurationMinutes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_doctor_profiles_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "core",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "doctor_leaves",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    LeaveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_leaves", x => x.Id);
                    table.ForeignKey(
                        name: "FK_doctor_leaves_doctor_profiles_DoctorProfileId",
                        column: x => x.DoctorProfileId,
                        principalSchema: "core",
                        principalTable: "doctor_profiles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_DoctorId_SlotStart",
                schema: "core",
                table: "appointments",
                columns: new[] { "DoctorId", "SlotStart" },
                unique: true,
                filter: "\"Status\" != 'Cancelled'");

            migrationBuilder.CreateIndex(
                name: "IX_doctor_leaves_DoctorId_LeaveDate",
                schema: "core",
                table: "doctor_leaves",
                columns: new[] { "DoctorId", "LeaveDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_doctor_leaves_DoctorProfileId",
                schema: "core",
                table: "doctor_leaves",
                column: "DoctorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_doctor_profiles_UserId",
                schema: "core",
                table: "doctor_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_slot_holds_DoctorId_SlotStart",
                schema: "core",
                table: "slot_holds",
                columns: new[] { "DoctorId", "SlotStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                schema: "core",
                table: "users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "appointments",
                schema: "core");

            migrationBuilder.DropTable(
                name: "doctor_leaves",
                schema: "core");

            migrationBuilder.DropTable(
                name: "prescriptions",
                schema: "core");

            migrationBuilder.DropTable(
                name: "slot_holds",
                schema: "core");

            migrationBuilder.DropTable(
                name: "doctor_profiles",
                schema: "core");

            migrationBuilder.DropTable(
                name: "users",
                schema: "core");
        }
    }
}
