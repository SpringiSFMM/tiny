package de.springisfm.discordplayerinfo;

import com.sun.net.httpserver.HttpServer;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.user.User;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.Statistic;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.NotNull;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.logging.Level;

public class DiscordPlayerInfo extends JavaPlugin {
    private HttpServer server;
    private FileConfiguration config;
    private LuckPerms luckPerms;
    private boolean essentialsEnabled;
    private PlayerDataCache playerDataCache;
    private TimeZoneManager timeZoneManager;
    private PermissionsManager permissionsManager;
    
    @Override
    public void onEnable() {
        // Konfiguration speichern/laden
        saveDefaultConfig();
        config = getConfig();
        
        // Standardwerte in der Konfiguration setzen (falls nicht vorhanden)
        config.addDefault("api.port", 8080);
        config.addDefault("api.api-key", "");
        config.addDefault("api.allow-cors", true);
        config.addDefault("api.allowed-origins", "*");
        config.addDefault("player-data.include-stats", true);
        config.addDefault("player-data.default-timezone", "Europe/Berlin");
        config.addDefault("player-data.cache-duration", 300);
        config.addDefault("debug.log-api-requests", false);
        config.addDefault("debug.log-timezone-events", false);
        config.addDefault("rank-format.title-case", true);
        config.options().copyDefaults(true);
        saveConfig();
        
        // PlayerDataCache initialisieren
        playerDataCache = new PlayerDataCache(this);
        
        // Event-Listener registrieren
        getServer().getPluginManager().registerEvents(new PlayerListener(this), this);
        
        // LuckPerms-Integration prüfen
        if (!setupLuckPerms()) {
            getLogger().warning("LuckPerms nicht gefunden! Rangfunktionen sind deaktiviert.");
        } else {
            getLogger().info("LuckPerms erfolgreich eingebunden.");
            // PermissionsManager initialisieren
            permissionsManager = new PermissionsManager(this, luckPerms);
        }
        
        // EssentialsX-Integration prüfen
        essentialsEnabled = getServer().getPluginManager().getPlugin("Essentials") != null;
        if (essentialsEnabled) {
            getLogger().info("EssentialsX erkannt. AFK-Status wird in den Spielerdaten angezeigt.");
        }
        
        // TimeZoneManager initialisieren und aktivieren
        timeZoneManager = new TimeZoneManager(this);
        timeZoneManager.initialize();
        
        // API-Server starten
        startApiServer();
        
        getLogger().info("DiscordPlayerInfo aktiviert!");
    }
    
    @Override
    public void onDisable() {
        // HTTP-Server stoppen
        if (server != null) {
            server.stop(0);
            getLogger().info("API Server stopped");
        }
        
        // TimeZoneManager herunterfahren und Daten speichern
        if (timeZoneManager != null) {
            timeZoneManager.shutdown();
        }
        
        getLogger().info("DiscordPlayerInfo deaktiviert!");
    }
    
    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, String[] args) {
        if (command.getName().equalsIgnoreCase("discordinfo")) {
            if (args.length == 0) {
                sender.sendMessage("§6DiscordPlayerInfo §7v" + getDescription().getVersion());
                sender.sendMessage("§7Commands: §f/discordinfo reload §7- Reloads the configuration");
                sender.sendMessage("§7Commands: §f/discordinfo stats §7- Shows API statistics");
                return true;
            }
            
            if (args[0].equalsIgnoreCase("reload")) {
                // Reload configuration
                reloadConfig();
                config = getConfig();
                
                // Restart API if needed
                if (server != null) {
                    server.stop(0);
                    if (config.getBoolean("api.enabled")) {
                        startApiServer();
                    }
                }
                
                sender.sendMessage("§6DiscordPlayerInfo §7configuration reloaded!");
                return true;
            }
            
            if (args[0].equalsIgnoreCase("stats")) {
                if (server != null) {
                    sender.sendMessage("§6API Stats:");
                    sender.sendMessage("§7Port: §f" + config.getInt("api.port"));
                    sender.sendMessage("§7Requests handled: §f" + ApiHandler.getRequestCount());
                    sender.sendMessage("§7Cache entries: §f" + playerDataCache.getCacheSize());
                } else {
                    sender.sendMessage("§cAPI is currently disabled.");
                }
                return true;
            }
        }
        
        return false;
    }
    
    private boolean setupLuckPerms() {
        RegisteredServiceProvider<LuckPerms> provider = Bukkit.getServicesManager().getRegistration(LuckPerms.class);
        if (provider != null) {
            luckPerms = provider.getProvider();
            return true;
        }
        return false;
    }
    
    private void startApiServer() {
        try {
            int port = config.getInt("api.port");
            server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/api/players", new ApiHandler.PlayersHandler(this));
            server.createContext("/api/status", new ApiHandler.StatusHandler(this));
            server.setExecutor(Executors.newCachedThreadPool());
            server.start();
            getLogger().info("API Server started on port " + port);
        } catch (IOException e) {
            getLogger().log(Level.SEVERE, "Failed to start API server", e);
        }
    }
    
    public Map<String, Object> getPlayerData(String username) {
        // Cache prüfen
        Map<String, Object> cachedData = playerDataCache.getCachedData(username);
        if (cachedData != null) {
            return cachedData;
        }
        
        // Spieler suchen
        OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(username);
        if (offlinePlayer == null || (!offlinePlayer.hasPlayedBefore() && !offlinePlayer.isOnline())) {
            return null;
        }
        
        Map<String, Object> playerData = new HashMap<>();
        playerData.put("username", offlinePlayer.getName());
        playerData.put("uuid", offlinePlayer.getUniqueId().toString());
        playerData.put("isOnline", offlinePlayer.isOnline());
        playerData.put("lastSeen", offlinePlayer.getLastPlayed());
        
        // Rangdaten über den PermissionsManager abrufen (erweiterte LuckPerms-Integration)
        if (permissionsManager != null) {
            Map<String, Object> rankInfo = permissionsManager.getPlayerRankInfo(offlinePlayer.getUniqueId());
            if (rankInfo != null) {
                // Die gesamte rankInfo Map in die playerData Map einfügen
                playerData.put("rank", rankInfo.get("displayName"));
                playerData.put("rankInfo", rankInfo);
            } else {
                playerData.put("rank", "Default");
            }
        } else {
            // Fallback auf einfaches Rang-Format, wenn PermissionsManager nicht verfügbar
            String rank = "Default";
            try {
                if (luckPerms != null) {
                    User user = luckPerms.getUserManager().loadUser(offlinePlayer.getUniqueId()).join();
                    if (user != null) {
                        String primaryGroup = user.getPrimaryGroup();
                        rank = primaryGroup.substring(0, 1).toUpperCase() + primaryGroup.substring(1);
                    }
                }
            } catch (Exception e) {
                getLogger().warning("Failed to get LuckPerms data for " + username + ": " + e.getMessage());
            }
            playerData.put("rank", rank);
        }
        
        // Account-Alter in Tagen berechnen
        if (offlinePlayer.hasPlayedBefore()) {
            long firstPlayed = offlinePlayer.getFirstPlayed();
            long currentTime = System.currentTimeMillis();
            long accountAgeDays = (currentTime - firstPlayed) / (1000 * 60 * 60 * 24);
            playerData.put("accountAge", accountAgeDays);
            playerData.put("firstJoined", firstPlayed);
        } else {
            playerData.put("accountAge", 0);
            playerData.put("firstJoined", 0);
        }
        
        // Zeitzone und zusätzliche Informationen für Online-Spieler
        if (offlinePlayer.isOnline()) {
            Player player = offlinePlayer.getPlayer();
            if (player != null) {
                playerData.put("displayName", player.getDisplayName());
                
                // Zeitzone vom TimeZoneManager abrufen
                String timezone = timeZoneManager != null ? 
                        timeZoneManager.getPlayerTimeZone(player.getUniqueId()) : 
                        config.getString("player-data.default-timezone");
                playerData.put("timezone", timezone);
                
                // AFK-Status von Essentials, falls verfügbar
                if (essentialsEnabled) {
                    try {
                        com.earth2me.essentials.Essentials essentials = (com.earth2me.essentials.Essentials) 
                            Bukkit.getPluginManager().getPlugin("Essentials");
                        if (essentials != null) {
                            boolean isAfk = essentials.getUser(player.getUniqueId()).isAfk();
                            playerData.put("afk", isAfk);
                        }
                    } catch (Exception e) {
                        getLogger().warning("Failed to get AFK status: " + e.getMessage());
                    }
                }
                
                // Spielerposition hinzufügen
                if (config.getBoolean("player-data.include-stats")) {
                    Map<String, Object> location = new HashMap<>();
                    location.put("world", player.getWorld().getName());
                    location.put("x", player.getLocation().getBlockX());
                    location.put("y", player.getLocation().getBlockY());
                    location.put("z", player.getLocation().getBlockZ());
                    playerData.put("location", location);
                }
            }
        }
        
        // Avatar-URL hinzufügen (nutzt Minecraft-Avatar-Dienst)
        playerData.put("avatarUrl", "https://mc-heads.net/avatar/" + username);
        
        // Daten cachen
        playerDataCache.cacheData(username, playerData);
        
        return playerData;
    }
    
    public FileConfiguration getPluginConfig() {
        return config;
    }
    
    public LuckPerms getLuckPerms() {
        return luckPerms;
    }
    
    public PlayerDataCache getPlayerDataCache() {
        return playerDataCache;
    }
    
    public TimeZoneManager getTimeZoneManager() {
        return timeZoneManager;
    }
    
    public PermissionsManager getPermissionsManager() {
        return permissionsManager;
    }
}
