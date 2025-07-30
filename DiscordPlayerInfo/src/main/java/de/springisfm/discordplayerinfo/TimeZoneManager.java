package de.springisfm.discordplayerinfo;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Manager für Spieler-Zeitzonendaten
 */
public class TimeZoneManager {
    private final DiscordPlayerInfo plugin;
    private final Map<UUID, String> playerTimeZones;
    private final String defaultTimeZone;
    private boolean initialized = false;

    public TimeZoneManager(DiscordPlayerInfo plugin) {
        this.plugin = plugin;
        this.playerTimeZones = new ConcurrentHashMap<>();
        
        // Standard-Zeitzone aus der Konfiguration laden
        FileConfiguration config = plugin.getConfig();
        this.defaultTimeZone = config.getString("player-data.default-timezone", "Europe/Berlin");
    }

    /**
     * Initialisiert den TimeZoneManager
     */
    public void initialize() {
        if (initialized) {
            return;
        }

        // Aus der Konfigurationsdatei laden (falls vorhanden)
        loadTimeZoneData();
        initialized = true;
        plugin.getLogger().info("TimeZoneManager initialized");
    }

    /**
     * Speichert alle Zeitzonen-Daten beim Server-Shutdown
     */
    public void shutdown() {
        saveTimeZoneData();
        plugin.getLogger().info("TimeZoneManager: Saved timezone data");
    }

    /**
     * Setzt die Zeitzone für einen Spieler
     * 
     * @param playerUUID Die UUID des Spielers
     * @param timeZone Die Zeitzone (z.B. "Europe/Berlin")
     */
    public void setPlayerTimeZone(UUID playerUUID, String timeZone) {
        playerTimeZones.put(playerUUID, timeZone);
        saveTimeZoneData(); // Zeitzone sofort speichern
        
        if (plugin.getConfig().getBoolean("debug.log-timezone-events", false)) {
            plugin.getLogger().info("Set timezone for " + playerUUID + " to " + timeZone);
        }
    }

    /**
     * Gibt die Zeitzone eines Spielers zurück
     * 
     * @param playerUUID Die UUID des Spielers
     * @return Die Zeitzone oder die Standard-Zeitzone, wenn keine gefunden wurde
     */
    public String getPlayerTimeZone(UUID playerUUID) {
        return playerTimeZones.getOrDefault(playerUUID, defaultTimeZone);
    }

    /**
     * Lädt Zeitzonen-Daten aus der Konfigurationsdatei
     */
    private void loadTimeZoneData() {
        try {
            if (!plugin.getDataFolder().exists()) {
                plugin.getDataFolder().mkdirs();
            }
            
            // Zeitzonen-Daten aus Konfiguration laden
            if (plugin.getConfig().isConfigurationSection("timezone-data")) {
                for (String uuidStr : plugin.getConfig().getConfigurationSection("timezone-data").getKeys(false)) {
                    try {
                        UUID uuid = UUID.fromString(uuidStr);
                        String timezone = plugin.getConfig().getString("timezone-data." + uuidStr);
                        if (timezone != null && !timezone.isEmpty()) {
                            playerTimeZones.put(uuid, timezone);
                        }
                    } catch (IllegalArgumentException e) {
                        plugin.getLogger().warning("Invalid UUID in timezone data: " + uuidStr);
                    }
                }
                plugin.getLogger().info("Loaded timezone data for " + playerTimeZones.size() + " players");
            }
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error loading timezone data", e);
        }
    }

    /**
     * Speichert Zeitzonen-Daten in die Konfigurationsdatei
     */
    private void saveTimeZoneData() {
        try {
            // In die Konfiguration speichern
            for (Map.Entry<UUID, String> entry : playerTimeZones.entrySet()) {
                plugin.getConfig().set("timezone-data." + entry.getKey().toString(), entry.getValue());
            }
            
            plugin.saveConfig();
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error saving timezone data", e);
        }
    }
}
