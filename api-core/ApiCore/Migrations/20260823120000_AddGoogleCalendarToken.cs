using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ApiCore.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleCalendarToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "google_calendar_tokens",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccessToken = table.Column<string>(type: "text", nullable: false),
                    RefreshToken = table.Column<string>(type: "text", nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_google_calendar_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_google_calendar_tokens_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "core",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_google_calendar_tokens_UserId",
                schema: "core",
                table: "google_calendar_tokens",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "google_calendar_tokens",
                schema: "core");
        }
    }
}
