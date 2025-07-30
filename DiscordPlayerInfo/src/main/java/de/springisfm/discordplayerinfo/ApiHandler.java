package de.springisfm.discordplayerinfo;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.bukkit.Bukkit;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * API-Handler für HTTP-Anfragen an das Plugin
 */
public class ApiHandler {
    private static final Gson GSON = new GsonBuilder().serializeNulls().create();
    private static final AtomicLong REQUEST_COUNT = new AtomicLong(0);
    
    /**
     * Gibt die Gesamtzahl der bearbeiteten API-Anfragen zurück
     * 
     * @return Anzahl der bearbeiteten Anfragen
     */
    public static long getRequestCount() {
        return REQUEST_COUNT.get();
    }
    
    /**
     * Handler für /api/players Endpunkt
     */
    public static class PlayersHandler implements HttpHandler {
        private final DiscordPlayerInfo plugin;
        
        public PlayersHandler(DiscordPlayerInfo plugin) {
            this.plugin = plugin;
        }
        
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            REQUEST_COUNT.incrementAndGet();
            
            // CORS-Header hinzufügen, falls aktiviert
            if (plugin.getPluginConfig().getBoolean("api.allow-cors", true)) {
                Headers headers = exchange.getResponseHeaders();
                headers.add("Access-Control-Allow-Origin", 
                    plugin.getPluginConfig().getString("api.allowed-origins", "*"));
                headers.add("Access-Control-Allow-Methods", "GET, OPTIONS");
                headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization");
                
                if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                    exchange.sendResponseHeaders(204, -1);
                    return;
                }
            }
            
            // Prüfen der API-Authentifizierung
            String apiKey = plugin.getPluginConfig().getString("api.api-key", "");
            if (!apiKey.isEmpty()) {
                Headers headers = exchange.getRequestHeaders();
                String authHeader = headers.getFirst("Authorization");
                
                if (authHeader == null || !authHeader.equals("Bearer " + apiKey)) {
                    sendResponse(exchange, 401, createErrorResponse("Unauthorized", "Invalid API key"));
                    return;
                }
            }
            
            // Log API-Anfragen im Debug-Modus
            if (plugin.getPluginConfig().getBoolean("debug.log-api-requests", false)) {
                plugin.getLogger().info("API request received: " + exchange.getRequestURI().toString());
            }
            
            String path = exchange.getRequestURI().getPath();
            String[] pathParts = path.split("/");
            
            // /api/players - Liste aller Spieler abrufen
            if (pathParts.length == 3) {
                if (!exchange.getRequestMethod().equals("GET")) {
                    sendResponse(exchange, 405, createErrorResponse("Method Not Allowed", "Only GET method is allowed"));
                    return;
                }
                
                Map<String, Object> response = new HashMap<>();
                response.put("online", Bukkit.getOnlinePlayers().size());
                response.put("max", Bukkit.getMaxPlayers());
                
                // Spielerliste nur hinzufügen, wenn es Online-Spieler gibt
                if (!Bukkit.getOnlinePlayers().isEmpty()) {
                    Map<String, String> players = new HashMap<>();
                    Bukkit.getOnlinePlayers().forEach(player -> 
                        players.put(player.getUniqueId().toString(), player.getName()));
                    response.put("players", players);
                }
                
                sendResponse(exchange, 200, response);
                return;
            }
            
            // /api/players/{username} - Informationen über einen bestimmten Spieler abrufen
            if (pathParts.length == 4) {
                if (!exchange.getRequestMethod().equals("GET")) {
                    sendResponse(exchange, 405, createErrorResponse("Method Not Allowed", "Only GET method is allowed"));
                    return;
                }
                
                String username = pathParts[3];
                Map<String, Object> playerData = plugin.getPlayerData(username);
                
                if (playerData == null) {
                    sendResponse(exchange, 404, createErrorResponse("Not Found", "Player not found"));
                    return;
                }
                
                sendResponse(exchange, 200, playerData);
                return;
            }
            
            // Ungültige API-Route
            sendResponse(exchange, 404, createErrorResponse("Not Found", "Invalid API endpoint"));
        }
        
        /**
         * Sendet eine JSON-Antwort zurück
         * 
         * @param exchange HttpExchange-Objekt
         * @param statusCode HTTP-Statuscode
         * @param responseObject Antwortobjekt (wird zu JSON konvertiert)
         * @throws IOException wenn ein Fehler beim Senden auftritt
         */
        private void sendResponse(HttpExchange exchange, int statusCode, Object responseObject) throws IOException {
            String response = GSON.toJson(responseObject);
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
            
            exchange.getResponseHeaders().add("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(statusCode, responseBytes.length);
            
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        }
        
        /**
         * Erstellt eine standardisierte Fehlerantwort
         * 
         * @param error Fehlertyp
         * @param message Fehlermeldung
         * @return Map mit Fehlerinformationen
         */
        private Map<String, Object> createErrorResponse(String error, String message) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", error);
            errorResponse.put("message", message);
            return errorResponse;
        }
    }
    
    /**
     * Handler für /api/status Endpunkt
     * Implementiert einen Health-Check für den Discord-Bot
     */
    public static class StatusHandler implements HttpHandler {
        private final DiscordPlayerInfo plugin;
        
        public StatusHandler(DiscordPlayerInfo plugin) {
            this.plugin = plugin;
        }
        
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            REQUEST_COUNT.incrementAndGet();
            
            // CORS-Header hinzufügen, falls aktiviert
            if (plugin.getPluginConfig().getBoolean("api.allow-cors", true)) {
                Headers headers = exchange.getResponseHeaders();
                headers.add("Access-Control-Allow-Origin", 
                    plugin.getPluginConfig().getString("api.allowed-origins", "*"));
                headers.add("Access-Control-Allow-Methods", "GET, OPTIONS");
                headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization");
                
                if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                    exchange.sendResponseHeaders(204, -1);
                    return;
                }
            }
            
            // Prüfen der API-Authentifizierung
            String apiKey = plugin.getPluginConfig().getString("api.api-key", "");
            if (!apiKey.isEmpty()) {
                Headers headers = exchange.getRequestHeaders();
                String authHeader = headers.getFirst("Authorization");
                
                if (authHeader == null || !authHeader.equals("Bearer " + apiKey)) {
                    sendResponse(exchange, 401, createErrorResponse("Unauthorized", "Invalid API key"));
                    return;
                }
            }
            
            // Log API-Anfragen im Debug-Modus
            if (plugin.getPluginConfig().getBoolean("debug.log-api-requests", false)) {
                plugin.getLogger().info("API status request received");
            }
            
            if (!exchange.getRequestMethod().equals("GET")) {
                sendResponse(exchange, 405, createErrorResponse("Method Not Allowed", "Only GET method is allowed"));
                return;
            }
            
            // Einfache Status-Response mit Server-Informationen
            Map<String, Object> response = new HashMap<>();
            response.put("status", "online");
            response.put("version", plugin.getDescription().getVersion());
            response.put("serverName", Bukkit.getServer().getName());
            response.put("serverVersion", Bukkit.getServer().getVersion());
            response.put("apiVersion", plugin.getDescription().getVersion());
            response.put("apiRequestCount", REQUEST_COUNT.get());
            response.put("playerCount", Bukkit.getOnlinePlayers().size());
            
            sendResponse(exchange, 200, response);
        }
        
        /**
         * Sendet eine JSON-Antwort zurück
         * 
         * @param exchange HttpExchange-Objekt
         * @param statusCode HTTP-Statuscode
         * @param responseObject Antwortobjekt (wird zu JSON konvertiert)
         * @throws IOException wenn ein Fehler beim Senden auftritt
         */
        private void sendResponse(HttpExchange exchange, int statusCode, Object responseObject) throws IOException {
            String response = GSON.toJson(responseObject);
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
            
            exchange.getResponseHeaders().add("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(statusCode, responseBytes.length);
            
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        }
        
        /**
         * Erstellt eine standardisierte Fehlerantwort
         * 
         * @param error Fehlertyp
         * @param message Fehlermeldung
         * @return Map mit Fehlerinformationen
         */
        private Map<String, Object> createErrorResponse(String error, String message) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", error);
            errorResponse.put("message", message);
            return errorResponse;
        }
    }
}
