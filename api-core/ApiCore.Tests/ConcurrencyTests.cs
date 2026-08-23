using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using ApiCore.Data;
using ApiCore.Models;
using ApiCore.Services;

namespace ApiCore.Tests;

/// <summary>
/// Boots a real in-process test server backed by InMemory DB
/// and fires 10 concurrent confirm requests at the same slot.
/// Exactly 1 must succeed; the rest must return 409.
/// </summary>
public class ConcurrencyTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    public ConcurrencyTests(TestWebAppFactory factory) => _factory = factory;

    [Fact]
    public async Task OnlyOneConfirmSucceedsForSameSlot()
    {
        // Seed: one doctor, one patient, one hold per concurrent request
        // We create 10 holds for the same slot (via direct DB) and fire
        // 10 confirm requests simultaneously.

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var slotStart = new DateTime(2030, 1, 15, 9, 0, 0, DateTimeKind.Utc);

        var hash = BCrypt.Net.BCrypt.HashPassword("TestPass123!");

        // Create doctor user + profile
        var doctorUser = new User
        {
            Email = "dr.test@example.com",
            PasswordHash = hash,
            Name = "Dr Test",
            Role = UserRole.Doctor
        };
        db.Users.Add(doctorUser);
        await db.SaveChangesAsync();

        var profile = new DoctorProfile
        {
            UserId = doctorUser.Id,
            Specialization = "General",
            WorkingHoursJson = "{\"wed\":{\"start\":\"09:00\",\"end\":\"17:00\"}}",
            SlotDurationMinutes = 20
        };
        db.DoctorProfiles.Add(profile);
        await db.SaveChangesAsync();

        // Create 10 patient users
        const int N = 10;
        var patients = new List<User>();

        for (int i = 0; i < N; i++)
        {
            var patient = new User
            {
                Email = $"patient{i}@example.com",
                PasswordHash = hash,
                Name = $"Patient {i}",
                Role = UserRole.Patient
            };
            db.Users.Add(patient);
            patients.Add(patient);
        }
        await db.SaveChangesAsync();

        var sharedHold = new SlotHold
        {
            DoctorId = profile.Id,
            SlotStart = slotStart,
            SlotEnd = slotStart.AddMinutes(20),
            PatientId = patients[0].Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        db.SlotHolds.Add(sharedHold);
        await db.SaveChangesAsync();

        // Get a JWT for patient 0
        var client = _factory.CreateClient();
        var loginResp = await client.PostAsJsonAsync("api/auth/login", new
        {
            email = patients[0].Email,
            password = "TestPass123!"
        });
        loginResp.EnsureSuccessStatusCode();

        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();

        var jwt = loginBody.GetProperty("token").GetString()!;

        // Fire 10 concurrent confirm requests
        var tasks = Enumerable.Range(0, N).Select(_ =>
        {
            var msg = new HttpRequestMessage(HttpMethod.Post, "api/appointments/confirm")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(new { holdId = sharedHold.Id, symptomText = "headache" }),
                    Encoding.UTF8, "application/json")
            };
            msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", jwt);
            return client.SendAsync(msg);
        }).ToList();

        var responses = await Task.WhenAll(tasks);
        var statusCodes = responses.Select(r => r.StatusCode).ToList();

        var successes = statusCodes.Count(s => s == HttpStatusCode.OK);
        var conflicts = statusCodes.Count(s => s == HttpStatusCode.Conflict);
        var notFounds = statusCodes.Count(s => s == HttpStatusCode.NotFound);

        // Exactly one success; rest are 409 Conflict or 404 (hold already taken)
        Assert.Equal(1, successes);
        Assert.Equal(N - 1, conflicts + notFounds);
    }
}

/// <summary>Custom WebApplicationFactory that sets environment to Testing.</summary>
public class TestWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            // Remove AiServiceClient (no real HTTP calls needed in tests)
            var aiDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(AiServiceClient));
            if (aiDescriptor != null) services.Remove(aiDescriptor);

            services.AddHttpClient<AiServiceClient>(client =>
            {
                client.BaseAddress = new Uri("http://localhost:9999/"); // unreachable — will fall back
                client.Timeout = TimeSpan.FromMilliseconds(100);
            });
        });
    }
}

