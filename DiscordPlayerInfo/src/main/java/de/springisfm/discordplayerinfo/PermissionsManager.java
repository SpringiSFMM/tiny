package de.springisfm.discordplayerinfo;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.model.user.User;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.InheritanceNode;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.stream.Collectors;

/**
 * Manager für die LuckPerms-Integration
 * Liefert erweiterte Berechtigungsinformationen für Spieler
 */
public class PermissionsManager {
    private final DiscordPlayerInfo plugin;
    private final LuckPerms luckPerms;
    
    public PermissionsManager(DiscordPlayerInfo plugin, LuckPerms luckPerms) {
        this.plugin = plugin;
        this.luckPerms = luckPerms;
    }
    
    /**
     * Gibt alle Informationen zu Rängen eines Spielers zurück
     * 
     * @param playerUUID UUID des Spielers
     * @return Map mit Ranginformationen oder null bei Fehler
     */
    public Map<String, Object> getPlayerRankInfo(UUID playerUUID) {
        if (luckPerms == null) {
            plugin.getLogger().warning("LuckPerms ist nicht verfügbar!");
            return null;
        }
        
        try {
            Map<String, Object> rankInfo = new HashMap<>();
            CompletableFuture<User> userFuture = luckPerms.getUserManager().loadUser(playerUUID);
            User user = userFuture.get(); // Blockiert, bis der User geladen ist
            
            if (user == null) {
                plugin.getLogger().warning("Konnte keinen LuckPerms-User für UUID " + playerUUID + " laden");
                return null;
            }
            
            // Primäre Gruppe und Details
            String primaryGroup = user.getPrimaryGroup();
            rankInfo.put("primaryGroup", primaryGroup);
            
            // Name der Gruppe mit Großbuchstaben formatieren
            String formattedGroupName = formatGroupName(primaryGroup);
            rankInfo.put("displayName", formattedGroupName);
            
            // Gewicht/Priorität der primären Gruppe
            try {
                Group group = luckPerms.getGroupManager().getGroup(primaryGroup);
                if (group != null) {
                    rankInfo.put("weight", group.getWeight().isPresent() ? 
                            group.getWeight().getAsInt() : 0);
                    
                    // Prefix der Gruppe, falls vorhanden
                    String prefix = group.getCachedData().getMetaData().getPrefix();
                    if (prefix != null) {
                        rankInfo.put("prefix", prefix);
                    }
                }
            } catch (Exception e) {
                plugin.getLogger().log(Level.WARNING, 
                        "Fehler beim Abrufen der Gruppendetails für " + primaryGroup, e);
            }
            
            // Alle Gruppen des Spielers (inkl. erbte)
            rankInfo.put("allGroups", user.getNodes().stream()
                    .filter(NodeType.INHERITANCE::matches)
                    .map(NodeType.INHERITANCE::cast)
                    .map(InheritanceNode::getGroupName)
                    .collect(Collectors.toList()));
            
            return rankInfo;
        } catch (InterruptedException | ExecutionException e) {
            plugin.getLogger().log(Level.WARNING, 
                    "Fehler beim Abrufen der Ranginformationen für " + playerUUID, e);
            Thread.currentThread().interrupt();
            return null;
        }
    }
    
    /**
     * Überprüft, ob ein Spieler eine bestimmte Berechtigung hat
     * 
     * @param playerUUID UUID des Spielers
     * @param permission Zu überprüfende Berechtigung
     * @return true, wenn der Spieler die Berechtigung hat
     */
    public boolean hasPermission(UUID playerUUID, String permission) {
        if (luckPerms == null) {
            return false;
        }
        
        try {
            User user = luckPerms.getUserManager().loadUser(playerUUID).get();
            if (user == null) {
                return false;
            }
            
            return user.getCachedData().getPermissionData().checkPermission(permission).asBoolean();
        } catch (InterruptedException | ExecutionException e) {
            plugin.getLogger().log(Level.WARNING, 
                    "Fehler beim Überprüfen der Berechtigung " + permission + 
                    " für Spieler " + playerUUID, e);
            Thread.currentThread().interrupt();
            return false;
        }
    }
    
    /**
     * Formatiert einen Gruppennamen schöner für die Anzeige
     * 
     * @param groupName Der Gruppenname aus LuckPerms
     * @return Formatierter Gruppenname
     */
    private String formatGroupName(String groupName) {
        if (groupName == null || groupName.isEmpty()) {
            return "Default";
        }
        
        // Format je nach Konfiguration
        if (plugin.getPluginConfig().getBoolean("rank-format.title-case", true)) {
            // Erster Buchstabe groß, Rest klein
            return groupName.substring(0, 1).toUpperCase() + 
                   groupName.substring(1).toLowerCase();
        } else {
            // Nur zurückgeben wie es ist
            return groupName;
        }
    }
}
