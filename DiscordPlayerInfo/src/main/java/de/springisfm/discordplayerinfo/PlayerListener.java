package de.springisfm.discordplayerinfo;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Listener für Spieler-bezogene Events
 */
public class PlayerListener implements Listener {
    private final DiscordPlayerInfo plugin;
    
    public PlayerListener(DiscordPlayerInfo plugin) {
        this.plugin = plugin;
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Spielerdaten-Cache invalidieren, damit neue Daten abgerufen werden
        Player player = event.getPlayer();
        plugin.getPlayerDataCache().invalidateCache(player.getName());
        
        // Wenn Debug aktiviert ist, Nachricht loggen
        if (plugin.getConfig().getBoolean("debug.enabled")) {
            plugin.getLogger().info("Player " + player.getName() + " joined, invalidated cache entry");
        }
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        // Spielerdaten-Cache invalidieren, damit neue Daten abgerufen werden
        Player player = event.getPlayer();
        plugin.getPlayerDataCache().invalidateCache(player.getName());
        
        // Wenn Debug aktiviert ist, Nachricht loggen
        if (plugin.getConfig().getBoolean("debug.enabled")) {
            plugin.getLogger().info("Player " + player.getName() + " quit, invalidated cache entry");
        }
    }
}
