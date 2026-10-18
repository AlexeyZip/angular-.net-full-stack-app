# syntax=docker/dockerfile:1
# Notifications microservice. Build context: services/notifications (see docker-compose.yml).

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY global.json ./
COPY src/Shop.Notifications/Shop.Notifications.csproj src/Shop.Notifications/
RUN dotnet restore src/Shop.Notifications/Shop.Notifications.csproj

COPY src/ src/
RUN dotnet publish src/Shop.Notifications/Shop.Notifications.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
ENV ASPNETCORE_URLS=http://+:8080
WORKDIR /app
COPY --from=build /app ./
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Shop.Notifications.dll"]
