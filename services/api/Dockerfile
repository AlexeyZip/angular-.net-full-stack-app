# syntax=docker/dockerfile:1
# Multi-stage build for the API. Build context: services/api (see docker-compose.yml).

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Restore first so the package layer is cached until a project file changes.
COPY global.json ./
COPY src/Shop.Api/Shop.Api.csproj src/Shop.Api/
RUN dotnet restore src/Shop.Api/Shop.Api.csproj

COPY src/ src/
RUN dotnet publish src/Shop.Api/Shop.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# Alpine: small, and busybox wget serves the compose health check. The project uses InvariantGlobalization,
# so no ICU package is needed.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
ENV ASPNETCORE_URLS=http://+:8080
WORKDIR /app
COPY --from=build /app ./
# The base image ships a non-root "app" user (UID 1654).
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Shop.Api.dll"]
