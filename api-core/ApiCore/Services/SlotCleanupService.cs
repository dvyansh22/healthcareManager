using ApiCore.Data;
using Microsoft.EntityFrameworkCore;

namespace ApiCore.Services;

/// <summary>
/// Runs every 60 seconds and purges expired slot holds.
/// Runs in background so it never blocks HTTP requests.
/// </summary>
public class SlotCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SlotCleanupService> _logger;

    public SlotCleanupService(IServiceScopeFactory scopeFactory, ILogger<SlotCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SlotCleanupService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredHoldsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during slot hold cleanup.");
            }

            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }
    }

    private async Task CleanupExpiredHoldsAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var deleted = await db.SlotHolds
            .Where(h => h.ExpiresAt < DateTime.UtcNow)
            .ExecuteDeleteAsync();

        if (deleted > 0)
            _logger.LogInformation("Cleaned up {Count} expired slot holds.", deleted);
    }
}
