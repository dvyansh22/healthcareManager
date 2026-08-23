using Google.Apis.Auth.OAuth2;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using ApiCore.Data;
using ApiCore.Models;
using Microsoft.EntityFrameworkCore;

namespace ApiCore.Services;

/// <summary>
/// Google Calendar integration using a clinic-owned OAuth2 service account / refresh token.
/// Gracefully degrades (logs warning, stores null event IDs) when credentials are not configured.
/// </summary>
public class GoogleCalendarService
{
    private readonly IConfiguration _config;
    private readonly ILogger<GoogleCalendarService> _logger;
    private readonly AppDbContext _db;

    private const string SystemUserEmail = "system"; // sentinel for the clinic-owned account

    public GoogleCalendarService(IConfiguration config, ILogger<GoogleCalendarService> logger, AppDbContext db)
    {
        _config = config;
        _logger = logger;
        _db = db;
    }

    /// <summary>
    /// Creates a shared calendar event for both patient and doctor.
    /// Returns the event ID on success, or null if Calendar is not configured / fails.
    /// </summary>
    public async Task<string?> CreateAppointmentEventAsync(
        Appointment appt,
        string patientEmail,
        string patientName,
        string doctorEmail,
        string doctorName)
    {
        var service = await GetCalendarServiceAsync();
        if (service is null) return null;

        try
        {
            var ev = new Event
            {
                Summary = $"Appointment: {patientName} with Dr. {doctorName}",
                Start = new EventDateTime { DateTimeDateTimeOffset = appt.SlotStart },
                End = new EventDateTime { DateTimeDateTimeOffset = appt.SlotEnd },
                Attendees = new List<EventAttendee>
                {
                    new() { Email = patientEmail },
                    new() { Email = doctorEmail }
                }
            };

            var request = service.Events.Insert(ev, "primary");
            request.SendUpdates = EventsResource.InsertRequest.SendUpdatesEnum.All;
            var created = await request.ExecuteAsync();
            return created.Id;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google Calendar event creation failed for appointment {Id}", appt.Id);
            return null;
        }
    }

    /// <summary>Deletes a calendar event. Silently succeeds if event ID is null or call fails.</summary>
    public async Task DeleteEventAsync(string? eventId)
    {
        if (string.IsNullOrEmpty(eventId)) return;

        var service = await GetCalendarServiceAsync();
        if (service is null) return;

        try
        {
            await service.Events.Delete("primary", eventId).ExecuteAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google Calendar event deletion failed for event {EventId}", eventId);
        }
    }

    private async Task<CalendarService?> GetCalendarServiceAsync()
    {
        var clientId = _config["Google:ClientId"];
        var clientSecret = _config["Google:ClientSecret"];
        var refreshToken = _config["Google:RefreshToken"];

        if (string.IsNullOrWhiteSpace(clientId) ||
            string.IsNullOrWhiteSpace(clientSecret) ||
            string.IsNullOrWhiteSpace(refreshToken))
        {
            _logger.LogWarning("Google Calendar credentials not configured — skipping Calendar operation.");
            return null;
        }

        var flow = new Google.Apis.Auth.OAuth2.Flows.GoogleAuthorizationCodeFlow(
            new Google.Apis.Auth.OAuth2.Flows.GoogleAuthorizationCodeFlow.Initializer
            {
                ClientSecrets = new ClientSecrets { ClientId = clientId, ClientSecret = clientSecret },
                Scopes = new[] { CalendarService.Scope.Calendar }
            });

        var token = new Google.Apis.Auth.OAuth2.Responses.TokenResponse { RefreshToken = refreshToken };
        var credential = new UserCredential(flow, "clinic-system", token);

        return new CalendarService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "HealthcareManager"
        });
    }
}
