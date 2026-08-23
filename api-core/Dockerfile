FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore as distinct layers
COPY ["ApiCore/ApiCore.csproj", "ApiCore/"]
RUN dotnet restore "ApiCore/ApiCore.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src/ApiCore"
RUN dotnet build "ApiCore.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ApiCore.csproj" -c Release -o /app/publish

# Build runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Expose port (Render automatically assigns PORT env var)
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "ApiCore.dll"]
