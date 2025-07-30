package de.springisfm.discordplayerinfo;

import org.bukkit.configuration.file.FileConfiguration;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache-System für Spielerdaten, um wiederholte Datenbankabfragen zu vermeiden
 */
public class PlayerDataCache {
    private final DiscordPlayerInfo plugin;
    private final Map<String, CacheEntry> cache;
    private int cacheDuration; // Seconds
    
    public PlayerDataCache(DiscordPlayerInfo plugin) {
        this.plugin = plugin;
        this.cache = new ConcurrentHashMap<>();
        this.cacheDuration = plugin.getConfig().getInt("player-data.cache-duration", 300);
    }
    
    /**
     * Fügt Spielerdaten zum Cache hinzu
     * 
     * @param username Spielername
     * @param data Spielerdaten
     */
    public void cacheData(String username, Map<String, Object> data) {
        if (username == null || data == null) return;
        
        cache.put(username.toLowerCase(), new CacheEntry(data));
        
        if (plugin.getConfig().getBoolean("debug.enabled")) {
            plugin.getLogger().info("Cached data for player: " + username);
        }
    }
    
    /**
     * Ruft Spielerdaten aus dem Cache ab, falls verfügbar und nicht abgelaufen
     * 
     * @param username Spielername
     * @return Spielerdaten oder null, wenn nicht im Cache oder abgelaufen
     */
    public Map<String, Object> getCachedData(String username) {
        if (username == null) return null;
        
        CacheEntry entry = cache.get(username.toLowerCase());
        if (entry == null) return null;
        
        // Prüfen, ob der Cache noch gültig ist
        if (System.currentTimeMillis() - entry.timestamp > cacheDuration * 1000) {
            cache.remove(username.toLowerCase());
            return null;
        }
        
        return entry.data;
    }
    
    /**
     * Leert den Cache für einen bestimmten Spieler
     * 
     * @param username Spielername
     */
    public void invalidateCache(String username) {
        if (username == null) return;
        cache.remove(username.toLowerCase());
    }
    
    /**
     * Leert den gesamten Cache
     */
    public void clearCache() {
        cache.clear();
        plugin.getLogger().info("Player data cache cleared");
    }
    
    /**
     * Aktualisiert die Cache-Dauer aus der Konfiguration
     */
    public void updateCacheDuration() {
        this.cacheDuration = plugin.getConfig().getInt("player-data.cache-duration", 300);
    }
    
    /**
     * Gibt die aktuelle Größe des Caches zurück
     * 
     * @return Anzahl der Einträge im Cache
     */
    public int getCacheSize() {
        return cache.size();
    }
    
    /**
     * Innere Klasse für Cache-Einträge mit Zeitstempel
     */
    private static class CacheEntry {
        final Map<String, Object> data;
        final long timestamp;
        
        public CacheEntry(Map<String, Object> data) {
            this.data = new HashMap<>(data);
            this.timestamp = System.currentTimeMillis();
        }
    }
}
