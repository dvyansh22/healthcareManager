using System.Text;
using System.Text.Json;
using ApiCore.Models;

namespace ApiCore.Services;

/// <summary>
/// HTTP client wrapper for calling ai-service internal endpoints.
/// All calls are fire-and-forget safe — failures are logged locally and never bubble up.
/// </summary>
public class AiServiceClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AiServiceClient> _logger;

    public AiServiceClient(HttpClient http, ILogger<AiServiceClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    /// <summary>Returns pre-visit summary JSON. On any failure returns fallback body.</summary>
    public async Task<string?> CallPreVisitAsync(Guid appointmentId, string? symptomText)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { appointmentId, symptomText });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var resp = await _http.PostAsync("internal/llm/pre-visit", content);
            resp.EnsureSuccessStatusCode();
            return await resp.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ai-service pre-visit call failed for appointment {Id}", appointmentId);
            return JsonSerializer.Serialize(new
            {
                urgency = "Unknown",
                chief_complaint = (symptomText ?? "")[ ..Math.Min(150, (symptomText ?? "").Length)],
                questions = Array.Empty<string>()
            });
        }
    }

    /// <summary>Returns post-visit summary JSON. On any failure returns fallback body.</summary>
    public async Task<string?> CallPostVisitAsync(Guid appointmentId, string? clinicalNotes)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { appointmentId, clinicalNotes });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var resp = await _http.PostAsync("internal/llm/post-visit", content);
            resp.EnsureSuccessStatusCode();
            return await resp.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ai-service post-visit call failed for appointment {Id}", appointmentId);
            return JsonSerializer.Serialize(new
            {
                summary_text = clinicalNotes ?? "",
                medication_schedule = Array.Empty<object>(),
                follow_up_steps = Array.Empty<string>()
            });
        }
    }

    /// <summary>Fire-and-forget: notify ai-service that booking was confirmed.</summary>
    public void FireAndForgetNotifyBookingConfirmed(Guid appointmentId)
        => _ = SendFireAndForgetAsync("internal/notify/booking-confirmed", new { appointmentId });

    /// <summary>Fire-and-forget: notify ai-service of cancellation.</summary>
    public void FireAndForgetNotifyCancellation(Guid appointmentId)
        => _ = SendFireAndForgetAsync("internal/notify/cancellation", new { appointmentId });

    /// <summary>Fire-and-forget: notify ai-service of leave-cascade cancellations.</summary>
    public void FireAndForgetNotifyLeaveCancellation(IEnumerable<Guid> appointmentIds)
        => _ = SendFireAndForgetAsync("internal/notify/leave-cancellation", new { appointmentIds });

    /// <summary>Fire-and-forget: notify ai-service that appointment is completed (schedules medication reminders).</summary>
    public void FireAndForgetNotifyBookingCompleted(Guid appointmentId)
        => _ = SendFireAndForgetAsync("internal/notify/booking-completed", new { appointmentId });

    private async Task SendFireAndForgetAsync(string path, object payload)
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            var body = JsonSerializer.Serialize(payload);
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            await _http.PostAsync(path, content, cts.Token);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Fire-and-forget call to {Path} failed", path);
        }
    }
}
