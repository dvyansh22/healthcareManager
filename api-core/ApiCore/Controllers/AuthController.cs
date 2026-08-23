using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiCore.Data;
using ApiCore.Models;
using ApiCore.Services;

namespace ApiCore.Controllers;

public record RegisterRequest(string Email, string Password, string Name, string? Phone, string? Role, string? Specialization);
public record LoginRequest(string Email, string Password);

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuthService _auth;

    public AuthController(AppDbContext db, AuthService auth)
    {
        _db = db;
        _auth = auth;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict(new { error = "Email already registered" });

        var roleEnum = UserRole.Patient;
        if (!string.IsNullOrEmpty(req.Role) && Enum.TryParse<UserRole>(req.Role, out var parsedRole))
        {
            if (parsedRole == UserRole.Doctor || parsedRole == UserRole.Patient)
            {
                roleEnum = parsedRole;
            }
        }

        var user = new User
        {
            Email = req.Email,
            PasswordHash = _auth.HashPassword(req.Password),
            Name = req.Name,
            Phone = req.Phone,
            Role = roleEnum
        };

        _db.Users.Add(user);
        
        if (roleEnum == UserRole.Doctor)
        {
            _db.DoctorProfiles.Add(new DoctorProfile
            {
                UserId = user.Id,
                Specialization = string.IsNullOrWhiteSpace(req.Specialization) ? "General Practice" : req.Specialization,
                SlotDurationMinutes = 20
            });
        }
        
        await _db.SaveChangesAsync();

        var token = _auth.GenerateToken(user);
        return Ok(new { token, user = new { user.Id, user.Email, user.Name, Role = user.Role.ToString() } });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null || !_auth.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid credentials" });

        var token = _auth.GenerateToken(user);
        return Ok(new { token, user = new { user.Id, user.Email, user.Name, Role = user.Role.ToString() } });
    }

}
