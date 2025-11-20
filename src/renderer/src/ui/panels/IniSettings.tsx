import React, { useEffect, useState } from 'react';

// Metadata for commonly adjusted ARK ASA server INI settings.
// We focus on GameUserSettings.ini [ServerSettings] and [SessionSettings], plus a few Game.ini entries.
interface IniFieldMeta {
  iniFile: 'GameUserSettings.ini' | 'Game.ini';
  section: string;
  key: string;
  label: string;
  description: string;
  type: 'number' | 'boolean' | 'string';
  default: string | number | boolean;
  min?: number;
  max?: number;
}

const FIELDS: IniFieldMeta[] = [
  // GameUserSettings.ini
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ServerPassword', label: 'Server Password', description: 'Password required to join (empty for none).', type: 'string', default: '' },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ServerAdminPassword', label: 'Admin Password', description: 'RCON / admin console password.', type: 'string', default: '' },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DifficultyOffset', label: 'Difficulty Offset', description: 'Base difficulty scaling (0.0 - 1.0).', type: 'number', default: 0.0, min: 0, max: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'OverrideOfficialDifficulty', label: 'Override Official Difficulty', description: 'Overrides max difficulty level (e.g. 5.0 for max 150 dinos).', type: 'number', default: 5.0, min: 0, max: 10 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'XPMultiplier', label: 'XP Multiplier', description: 'Experience gain multiplier.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'TamingSpeedMultiplier', label: 'Taming Speed Multiplier', description: 'Taming rate multiplier.', type: 'number', default: 1.0, min: 0.1, max: 50 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'HarvestAmountMultiplier', label: 'Harvest Amount Multiplier', description: 'Resource harvest quantity multiplier.', type: 'number', default: 1.0, min: 0.1, max: 50 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ResourcesRespawnPeriodMultiplier', label: 'Resource Respawn Period Multiplier', description: 'Higher values make resources take longer to respawn.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'StructureDamageMultiplier', label: 'Structure Damage Multiplier', description: 'Damage dealt to structures multiplier.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PlayerCharacterWaterDrainMultiplier', label: 'Player Water Drain', description: 'Rate at which player water decreases.', type: 'number', default: 1.0, min: 0.1, max: 5 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PlayerCharacterFoodDrainMultiplier', label: 'Player Food Drain', description: 'Rate at which player food decreases.', type: 'number', default: 1.0, min: 0.1, max: 5 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PlayerCharacterHealthRecoveryMultiplier', label: 'Player Health Recovery', description: 'Health regeneration rate multiplier.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DinoCharacterHealthRecoveryMultiplier', label: 'Dino Health Recovery', description: 'Dinosaur health regeneration rate.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DinoCharacterFoodDrainMultiplier', label: 'Dino Food Drain', description: 'Dinosaur food consumption rate.', type: 'number', default: 1.0, min: 0.1, max: 5 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DinoCharacterStaminaDrainMultiplier', label: 'Dino Stamina Drain', description: 'Dinosaur stamina drain rate.', type: 'number', default: 1.0, min: 0.1, max: 5 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DinoCountMultiplier', label: 'Dino Count Multiplier', description: 'Global dino population density.', type: 'number', default: 1.0, min: 0.25, max: 5 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PvPStructureDecay', label: 'PvP Structure Decay', description: 'Enable structure decay in PvP.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'EnablePVP', label: 'Enable PvP', description: 'If disabled, server behaves as PvE only.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowThirdPersonPlayer', label: 'Allow Third Person', description: 'Allows players to toggle third-person view.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ShowMapPlayerLocation', label: 'Show Map Player Location', description: 'Shows player position on map.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'NoTributeDownloads', label: 'Disable Tribute Downloads', description: 'Prevents uploading/downloading survivors items dinos.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'SessionSettings', key: 'SessionName', label: 'Session Name', description: 'Displayed server name.', type: 'string', default: 'My ASA Server' },
  { iniFile: 'GameUserSettings.ini', section: 'SessionSettings', key: 'ServerIsProtected', label: 'Server Is Protected', description: 'Marks server as protected (visibility control).', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'RCONEnabled', label: 'RCON Enabled', description: 'Allow remote console connections.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AutoSavePeriodMinutes', label: 'Auto Save Period Minutes', description: 'Interval between automatic world saves.', type: 'number', default: 15, min: 1, max: 120 },
  // Game.ini common tweaks
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'GlobalSpoilingTimeMultiplier', label: 'Spoiling Time Multiplier', description: 'Adjust spoil timers (higher = slower spoil).', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'GlobalItemDecompositionTimeMultiplier', label: 'Item Decomposition Time', description: 'Time before dropped items disappear.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'GlobalCorpseDecompositionTimeMultiplier', label: 'Corpse Decomposition Time', description: 'Time before corpses vanish.', type: 'number', default: 1.0, min: 0.1, max: 10 },
  // Extended curated keys from user list (ServerSettings)
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'StartTimeOverride', label: 'Start Time Override', description: 'Override start time boolean.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'StartTimeHour', label: 'Start Time Hour', description: 'Hour fraction to start world at.', type: 'number', default: 0, min: 0, max: 24 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ListenServerTetherDistanceMultiplier', label: 'Tether Distance Multiplier', description: 'Listen server player tether distance.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'RaidDinoCharacterFoodDrainMultiplier', label: 'Raid Dino Food Drain', description: 'Raid dino food drain multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'StructurePreventResourceRadiusMultiplier', label: 'Structure Prevent Resource Radius', description: 'Radius preventing resource respawn near structures.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PvEDinoDecayPeriodMultiplier', label: 'PvE Dino Decay Period', description: 'PvE dino decay period multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowRaidDinoFeeding', label: 'Allow Raid Dino Feeding', description: 'Allow feeding of raid dinos.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PerPlatformMaxStructuresMultiplier', label: 'Per-Platform Max Structures', description: 'Maximum structures per platform multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'GlobalVoiceChat', label: 'Global Voice Chat', description: 'Enable global voice chat.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ProximityChat', label: 'Proximity Chat', description: 'Enable proximity chat.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AlwaysNotifyPlayerLeft', label: 'Notify Player Left', description: 'Notify when players leave.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DontAlwaysNotifyPlayerJoined', label: 'Skip Notify Player Joined', description: 'Suppress join notifications.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ServerHardcore', label: 'Hardcore Mode', description: 'Enable hardcore mode.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ServerPVE', label: 'PvE Mode', description: 'Enable PvE mode.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ServerCrosshair', label: 'Server Crosshair', description: 'Show crosshair.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ServerForceNoHUD', label: 'Force No HUD', description: 'Disable HUD for all players.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'EnablePvPGamma', label: 'Enable PvP Gamma', description: 'Allow gamma changes in PvP.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DisableStructureDecayPvE', label: 'Disable Structure Decay PvE', description: 'Disables structure decay in PvE.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowFlyerCarryPvE', label: 'Allow Flyer Carry PvE', description: 'Enable flyer carrying in PvE.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'OnlyAllowSpecifiedEngrams', label: 'Only Allow Specified Engrams', description: 'Restrict engrams to whitelist.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowHideDamageSourceFromLogs', label: 'Hide Damage Source From Logs', description: 'Hide damage source in logs.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'RandomSupplyCratePoints', label: 'Random Supply Crate Points', description: 'Randomize supply crate points.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DisableWeatherFog', label: 'Disable Weather Fog', description: 'Disable weather related fog.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventDownloadSurvivors', label: 'Prevent Download Survivors', description: 'Block survivor downloads.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventDownloadItems', label: 'Prevent Download Items', description: 'Block item downloads.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventDownloadDinos', label: 'Prevent Download Dinos', description: 'Block dino downloads.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DisablePvEGamma', label: 'Disable PvE Gamma', description: 'Disable gamma changes in PvE.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DisableDinoDecayPvE', label: 'Disable Dino Decay PvE', description: 'Disable dino decay in PvE.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AdminLogging', label: 'Admin Logging', description: 'Enable admin actions logging.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowCaveBuildingPvE', label: 'Allow Cave Building PvE', description: 'Allow building in caves PvE.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ForceAllowCaveFlyers', label: 'Force Allow Cave Flyers', description: 'Allow flyers in caves.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventOfflinePvP', label: 'Prevent Offline PvP', description: 'Enable offline PvP protection.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PvPDinoDecay', label: 'PvP Dino Decay', description: 'Enable dino decay in PvP.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'OverrideStructurePlatformPrevention', label: 'Override Structure Platform Prevention', description: 'Override building prevention on platforms.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowAnyoneBabyImprintCuddle', label: 'Allow Anyone Baby Imprint Cuddle', description: 'Allow anyone to imprint.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'DisableImprintDinoBuff', label: 'Disable Imprint Dino Buff', description: 'Disable imprint dino buff.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ShowFloatingDamageText', label: 'Show Floating Damage Text', description: 'Show damage numbers floating.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventDiseases', label: 'Prevent Diseases', description: 'Prevent player diseases.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'NonPermanentDiseases', label: 'Non-Permanent Diseases', description: 'Diseases are not permanent.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'EnableExtraStructurePreventionVolumes', label: 'Extra Structure Prevention Volumes', description: 'Enable extra prevention volumes.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventTribeAlliances', label: 'Prevent Tribe Alliances', description: 'Disable tribe alliances.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'bAllowSpeedLeveling', label: 'Allow Speed Leveling', description: 'Allow speed stat leveling.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'bAllowFlyerSpeedLeveling', label: 'Allow Flyer Speed Leveling', description: 'Allow speed leveling for flyers.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PreventOfflinePvPInterval', label: 'Prevent Offline PvP Interval', description: 'Offline PvP protection interval.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'CraftingSkillBonusMultiplier', label: 'Crafting Skill Bonus Multiplier', description: 'Crafting skill bonus multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'SupplyCrateLootQualityMultiplier', label: 'Supply Crate Loot Quality Multiplier', description: 'Loot crate quality multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ActiveEvent', label: 'Active Event', description: 'Active event name.', type: 'string', default: '' },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'OverrideStartTime', label: 'Override Start Time', description: 'Override start time flag.', type: 'boolean', default: false },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ActiveMods', label: 'Active Mods', description: 'Comma separated active mods.', type: 'string', default: '' },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ActiveMapMod', label: 'Active Map Mod', description: 'Active map mod id.', type: 'number', default: 0 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'RCONPort', label: 'RCON Port', description: 'Port for RCON.', type: 'number', default: 27020 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'TheMaxStructuresInRange', label: 'Max Structures In Range', description: 'Max structures in range.', type: 'number', default: 10500 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'OxygenSwimSpeedStatMultiplier', label: 'Oxygen Swim Speed Stat Multiplier', description: 'Oxygen swim speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'TribeNameChangeCooldown', label: 'Tribe Name Change Cooldown', description: 'Cooldown between tribe name changes.', type: 'number', default: 15 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'PlatformSaddleBuildAreaBoundsMultiplier', label: 'Platform Saddle Build Bounds Mult.', description: 'Platform saddle build area bounds multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AlwaysAllowStructurePickup', label: 'Always Allow Structure Pickup', description: 'Always allow structure pickup.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'StructurePickupTimeAfterPlacement', label: 'Structure Pickup Time After Placement', description: 'Time window to pickup after placement.', type: 'number', default: 30 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'StructurePickupHoldDuration', label: 'Structure Pickup Hold Duration', description: 'Hold duration to pickup.', type: 'number', default: 0.5 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'KickIdlePlayersPeriod', label: 'Kick Idle Players Period', description: 'Seconds before idle kick.', type: 'number', default: 3600 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'MaxTamedDinos', label: 'Max Tamed Dinos', description: 'Hard tame limit.', type: 'number', default: 5000 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ItemStackSizeMultiplier', label: 'Item Stack Size Multiplier', description: 'Item stack size multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'RCONServerGameLogBuffer', label: 'RCON Server Game Log Buffer', description: 'RCON log buffer size.', type: 'number', default: 600 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'ImplantSuicideCD', label: 'Implant Suicide Cooldown', description: 'Implant suicide cooldown seconds.', type: 'number', default: 28800 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'AllowHitMarkers', label: 'Allow Hit Markers', description: 'Enable hit markers.', type: 'boolean', default: true },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'MaxTamedDinos_SoftTameLimit', label: 'Soft Tame Limit', description: 'Soft tame limit before countdown deletion.', type: 'number', default: 5000 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'MaxTamedDinos_SoftTameLimit_CountdownForDeletionDuration', label: 'Soft Tame Deletion Countdown Dur.', description: 'Countdown duration for deletion after soft limit.', type: 'number', default: 604800 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'MaxPlayers', label: 'Max Players', description: 'Max concurrent players.', type: 'number', default: 70 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'BabyImprintingStatScaleMultiplier', label: 'Baby Imprinting Stat Scale', description: 'Imprinting stat scale multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'BabyCuddleIntervalMultiplier', label: 'Baby Cuddle Interval', description: 'Baby cuddle interval multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'BabyCuddleGracePeriodMultiplier', label: 'Baby Cuddle Grace Period', description: 'Grace period multiplier.', type: 'number', default: 1 },
  { iniFile: 'GameUserSettings.ini', section: 'ServerSettings', key: 'BabyCuddleLoseImprintQualitySpeedMultiplier', label: 'Baby Cuddle Lose Quality Speed', description: 'Lose imprint quality speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'PvPZoneStructureDamageMultiplier', label: 'PvP Zone Structure Damage Mult.', description: 'PvP zone structure damage multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'StructureDamageRepairCooldown', label: 'Structure Damage Repair Cooldown', description: 'Cooldown before structure repair.', type: 'number', default: 180 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'IncreasePvPRespawnIntervalCheckPeriod', label: 'PvP Respawn Interval Check Period', description: 'Check period for respawn interval.', type: 'number', default: 300 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'IncreasePvPRespawnIntervalMultiplier', label: 'PvP Respawn Interval Multiplier', description: 'Respawn interval multiplier.', type: 'number', default: 2 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'IncreasePvPRespawnIntervalBaseAmount', label: 'PvP Respawn Base Amount', description: 'Base amount for PvP respawn.', type: 'number', default: 60 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'CropGrowthSpeedMultiplier', label: 'Crop Growth Speed Mult.', description: 'Crop growth speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'LayEggIntervalMultiplier', label: 'Lay Egg Interval Mult.', description: 'Egg laying interval multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'PoopIntervalMultiplier', label: 'Poop Interval Mult.', description: 'Poop interval multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'CropDecaySpeedMultiplier', label: 'Crop Decay Speed Mult.', description: 'Crop decay speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'MatingIntervalMultiplier', label: 'Mating Interval Mult.', description: 'Mating interval multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'EggHatchSpeedMultiplier', label: 'Egg Hatch Speed Mult.', description: 'Egg hatch speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'BabyMatureSpeedMultiplier', label: 'Baby Mature Speed Mult.', description: 'Baby mature speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'BabyFoodConsumptionSpeedMultiplier', label: 'Baby Food Consumption Speed Mult.', description: 'Baby food consumption speed multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'DinoTurretDamageMultiplier', label: 'Dino Turret Damage Mult.', description: 'Dino turret damage multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'DinoHarvestingDamageMultiplier', label: 'Dino Harvesting Damage Mult.', description: 'Dino harvesting damage multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'PlayerHarvestingDamageMultiplier', label: 'Player Harvesting Damage Mult.', description: 'Player harvesting damage multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'KillXPMultiplier', label: 'Kill XP Multiplier', description: 'Kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'HarvestXPMultiplier', label: 'Harvest XP Multiplier', description: 'Harvest XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'CraftXPMultiplier', label: 'Craft XP Multiplier', description: 'Craft XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'GenericXPMultiplier', label: 'Generic XP Multiplier', description: 'Generic XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'SpecialXPMultiplier', label: 'Special XP Multiplier', description: 'Special XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'FuelConsumptionIntervalMultiplier', label: 'Fuel Consumption Interval Mult.', description: 'Fuel consumption interval multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'PhotoModeRangeLimit', label: 'Photo Mode Range Limit', description: 'Photo mode range limit.', type: 'number', default: 3000 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bDisablePhotoMode', label: 'Disable Photo Mode', description: 'Disable photo mode.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bIncreasePvPRespawnInterval', label: 'Increase PvP Respawn Interval', description: 'Increase respawn interval in PvP.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bAutoPvETimer', label: 'Auto PvE Timer', description: 'Enable auto PvE timer.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bAutoPvEUseSystemTime', label: 'Auto PvE Use System Time', description: 'Use system time for auto PvE.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bDisableFriendlyFire', label: 'Disable Friendly Fire', description: 'Disable friendly fire.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bFlyerPlatformAllowUnalignedDinoBasing', label: 'Flyer Platform Allow Unaligned Dino Basing', description: 'Allow unaligned dino basing on flyer platform.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bDisableLootCrates', label: 'Disable Loot Crates', description: 'Disable loot crates.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bAllowCustomRecipes', label: 'Allow Custom Recipes', description: 'Enable custom recipes.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bPassiveDefensesDamageRiderlessDinos', label: 'Passive Defenses Damage Riderless Dinos', description: 'Passive defenses damage riderless dinos.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bPvEAllowTribeWar', label: 'PvE Allow Tribe War', description: 'Allow tribe war in PvE.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bPvEAllowTribeWarCancel', label: 'PvE Allow Tribe War Cancel', description: 'Allow tribe war cancel in PvE.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'MaxDifficulty', label: 'Max Difficulty', description: 'Enable max difficulty.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bUseSingleplayerSettings', label: 'Use Singleplayer Settings', description: 'Use singleplayer settings.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bUseCorpseLocator', label: 'Use Corpse Locator', description: 'Use corpse locator.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bShowCreativeMode', label: 'Show Creative Mode', description: 'Show creative mode option.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bHardLimitTurretsInRange', label: 'Hard Limit Turrets In Range', description: 'Hard limit turrets in range.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bDisableStructurePlacementCollision', label: 'Disable Structure Placement Collision', description: 'Disable placement collision.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bAllowPlatformSaddleMultiFloors', label: 'Allow Platform Saddle Multi Floors', description: 'Allow multiple floors on platform saddles.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bAllowUnlimitedRespecs', label: 'Allow Unlimited Respecs', description: 'Enable unlimited respecs.', type: 'boolean', default: true },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bDisableDinoRiding', label: 'Disable Dino Riding', description: 'Disable dino riding.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'bDisableDinoTaming', label: 'Disable Dino Taming', description: 'Disable dino taming.', type: 'boolean', default: false },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'OverrideMaxExperiencePointsPlayer', label: 'Override Max XP Player', description: 'Override max XP for players.', type: 'number', default: 0 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'OverrideMaxExperiencePointsDino', label: 'Override Max XP Dino', description: 'Override max XP for dinos.', type: 'number', default: 0 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'MaxNumberOfPlayersInTribe', label: 'Max Players In Tribe', description: 'Max number of players per tribe.', type: 'number', default: 0 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'ExplorerNoteXPMultiplier', label: 'Explorer Note XP Multiplier', description: 'Explorer note XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'BossKillXPMultiplier', label: 'Boss Kill XP Multiplier', description: 'Boss kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'AlphaKillXPMultiplier', label: 'Alpha Kill XP Multiplier', description: 'Alpha kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'WildKillXPMultiplier', label: 'Wild Kill XP Multiplier', description: 'Wild kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'CaveKillXPMultiplier', label: 'Cave Kill XP Multiplier', description: 'Cave kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'TamedKillXPMultiplier', label: 'Tamed Kill XP Multiplier', description: 'Tamed kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'UnclaimedKillXPMultiplier', label: 'Unclaimed Kill XP Multiplier', description: 'Unclaimed kill XP multiplier.', type: 'number', default: 1 },
  { iniFile: 'Game.ini', section: 'ScriptShooterGame', key: 'FishingLootQualityMultiplier', label: 'Fishing Loot Quality Multiplier', description: 'Fishing loot quality multiplier.', type: 'number', default: 1 },
  // Additional multipliers kept advanced; user can edit all in advanced panel for stat arrays
];

type IniData = Record<string, Record<string, any>>; // section -> key -> value

export function IniSettingsPanel() {
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gameUserSettings, setGameUserSettings] = useState<IniData>({});
  const [gameIni, setGameIni] = useState<IniData>({});
  const [originalGameUserSettings, setOriginalGameUserSettings] = useState<IniData>({});
  const [originalGameIni, setOriginalGameIni] = useState<IniData>({});
  const [log, setLog] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState('');

  useEffect(() => {
    window.api.settings.get().then(async (s) => {
      setWorkspaceRoot(s.workspaceRoot);
      try {
        const state = await (window as any).api.profiles.list();
        setProfiles(state.servers || []);
        const first = state.servers?.[0]?.id;
        if (first) setSelectedServerId(first);
        await loadFiles(s.workspaceRoot, first);
      } catch (e: any) {
        setLog(String(e?.message ?? e));
      }
    });
  }, []);

  const buildPath = (file: string) => {
    if (!selectedServerId) return `${workspaceRoot.replace(/\\/g,'/')}/servers/asa/ShooterGame/Saved/Config/WindowsServer/${file}`;
    const server = profiles.find(p => p.id === selectedServerId);
    if (!server) return `${workspaceRoot.replace(/\\/g,'/')}/servers/asa/ShooterGame/Saved/Config/WindowsServer/${file}`;
    // assume installDir contains ShooterGame directory root
    return `${server.installDir.replace(/\\/g,'/')}/ShooterGame/Saved/Config/WindowsServer/${file}`;
  };

  const loadFiles = async (root: string, serverId?: string) => {
    setLoading(true);
    try {
      const gusText = await window.api.ini.readText(buildPath('GameUserSettings.ini'));
      const giText = await window.api.ini.readText(buildPath('Game.ini'));
      // naive parse using ini lib expectations: we can reuse a manual parser since service only exposes text
      const parseIni = (content: string): IniData => {
        const out: IniData = {};
        let current: string | null = null;
        content.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) { current = trimmed.slice(1, -1); if (!out[current]) out[current] = {}; return; }
          const eq = trimmed.indexOf('=');
            if (eq > 0 && current) {
              const k = trimmed.slice(0, eq).trim();
              const vRaw = trimmed.slice(eq + 1).trim();
              out[current][k] = vRaw;
            }
        });
        return out;
      };
      const gusParsed = parseIni(gusText);
      const giParsed = parseIni(giText);
      setGameUserSettings(gusParsed);
      setGameIni(giParsed);
      setOriginalGameUserSettings(gusParsed);
      setOriginalGameIni(giParsed);
      setLog(`Loaded INI files${serverId ? ' for server ' + serverId : ''}`);
    } catch (e: any) {
      setLog('Load error: ' + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const setValue = (f: IniFieldMeta, value: any) => {
    const target = f.iniFile === 'GameUserSettings.ini' ? gameUserSettings : gameIni;
    const setter = f.iniFile === 'GameUserSettings.ini' ? setGameUserSettings : setGameIni;
    const section = target[f.section] || {}; section[f.key] = value;
    setter({ ...target, [f.section]: { ...section } });
  };

  const resolveValue = (f: IniFieldMeta) => {
    const source = f.iniFile === 'GameUserSettings.ini' ? gameUserSettings : gameIni;
    return source[f.section]?.[f.key] ?? f.default;
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // basic numeric validation before write
      const invalid: string[] = [];
      FIELDS.forEach(f => {
        if (f.type === 'number') {
          const v = parseFloat(String(resolveValue(f)));
          if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max) || Number.isNaN(v)) {
            invalid.push(`${f.key}=${resolveValue(f)} (range ${f.min}-${f.max})`);
          }
        }
      });
      if (invalid.length) {
        setLog(l => l + `\nValidation failed: ${invalid.join(', ')}`);
        setSaving(false);
        return;
      }
      const stringify = (data: IniData): string => {
        return Object.entries(data).map(([section, kv]) => {
          const lines = Object.entries(kv).map(([k, v]) => `${k}=${v}`);
          return `[${section}]\n${lines.join('\n')}`;
        }).join('\n\n');
      };
      const gusOut = stringify(gameUserSettings);
      const giOut = stringify(gameIni);
      await window.api.ini.writeText(buildPath('GameUserSettings.ini'), gusOut);
      await window.api.ini.writeText(buildPath('Game.ini'), giOut);
      setLog((l) => l + '\nSaved INI settings');
    } catch (e: any) {
      setLog((l) => l + '\nSave error: ' + String(e?.message ?? e));
    } finally { setSaving(false); }
  };

  const grouped = FIELDS.reduce<Record<string, IniFieldMeta[]>>((acc, f) => {
    const g = `${f.iniFile} :: ${f.section}`;
    (acc[g] ||= []).push(f);
    return acc;
  }, {});

  const diffEntries = () => {
    const diffs: Array<{ field: IniFieldMeta; current: any; original: any; def: any }> = [];
    FIELDS.forEach(f => {
      const current = resolveValue(f);
      const originalSource = f.iniFile === 'GameUserSettings.ini' ? originalGameUserSettings : originalGameIni;
      const original = originalSource[f.section]?.[f.key];
      const def = f.default;
      if (String(current) !== String(original)) {
        diffs.push({ field: f, current, original, def });
      }
    });
    return diffs;
  };

  return (
    <section className="panel">
      <h2 className="panel-title" style={{ marginTop:0 }}>INI Settings</h2>
      <div style={{ fontSize:12, opacity:.75, marginBottom:12 }}>Editing commonly used server parameters. Advanced entries can still be changed via raw editor.</div>
      <div style={{ marginBottom:12, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ fontSize:12, opacity:.7 }}>Server Profile</span>
          <select value={selectedServerId} onChange={(e)=>{ setSelectedServerId(e.target.value); loadFiles(workspaceRoot, e.target.value).catch(err=>setLog(String(err?.message ?? err))); }}>
            {profiles.length === 0 && <option value="">(No servers found)</option>}
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
          </select>
        </label>
        <button onClick={()=>loadFiles(workspaceRoot, selectedServerId)} disabled={loading}>Reload Selected</button>
        <button onClick={()=>setShowDiff(d=>!d)} disabled={loading}>{showDiff ? 'Hide Changes' : 'Show Changes'}</button>
        <button onClick={()=>setShowAdvanced(a=>!a)} disabled={loading}>{showAdvanced ? 'Hide All Keys' : 'Show All Keys'}</button>
        {showAdvanced && (
          <input style={{ minWidth:180 }} placeholder="Filter keys" value={advancedFilter} onChange={(e)=>setAdvancedFilter(e.target.value)} />
        )}
      </div>
      {loading && <div>Loading INI files…</div>}
      {showDiff && !loading && (
        <div className="panel" style={{ marginBottom:16 }}>
          <div className="panel-title" style={{ background:'var(--bg-panel)', padding:'6px 10px', borderRadius:'var(--radius-sm)' }}>Changed Values</div>
          <div className="scroll" style={{ maxHeight:180, fontSize:12, padding:8 }}>
            {diffEntries().length === 0 && <div style={{ opacity:.6 }}>No changes from original load.</div>}
            {diffEntries().map(d => (
              <div key={d.field.key} style={{ display:'flex', flexDirection:'column', marginBottom:6 }}>
                <strong>{d.field.key}</strong>
                <span style={{ opacity:.7 }}>Original: {String(d.original ?? '(unset)')} | Current: {String(d.current)} | Default: {String(d.def)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && Object.entries(grouped).map(([group, fields]) => (
        <div key={group} className="panel" style={{ marginBottom:12 }}>
          <div className="panel-title" style={{ background:'#2a2a2a', padding:'6px 10px', borderRadius:'var(--radius-sm)' }}>{group}</div>
          <div style={{ display:'grid', gap:8, padding:10 }}>
            {fields.map((f) => {
              const value = resolveValue(f);
              const numInvalid = f.type === 'number' && (() => { const vNum = parseFloat(String(value)); return (f.min !== undefined && vNum < f.min) || (f.max !== undefined && vNum > f.max) || Number.isNaN(vNum); })();
              return (
                <label key={f.key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{f.label} <span style={{ fontSize:10, opacity:.5 }}>({f.key})</span></span>
                  {f.type === 'boolean' && (
                    <input type="checkbox" checked={value === true || value === 'true'} onChange={(e)=>setValue(f, e.target.checked ? 'true' : 'false')} />
                  )}
                  {f.type === 'number' && (
                    <>
                      <input type="number" value={value} min={f.min} max={f.max} step={0.1} onChange={(e)=>setValue(f, e.target.value)} style={numInvalid ? { border:'1px solid #d27d2c', background:'#2a1a1a' } : undefined} />
                      {numInvalid && <span style={{ color:'#d27d2c', fontSize:10 }}>Out of range ({f.min} - {f.max})</span>}
                    </>
                  )}
                  {f.type === 'string' && (
                    <input type="text" value={value} onChange={(e)=>setValue(f, e.target.value)} />
                  )}
                  <small style={{ opacity:.6 }}>{f.description}</small>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {showAdvanced && !loading && (
        <div className="panel" style={{ marginBottom:16 }}>
          <div className="panel-title" style={{ background:'#333', padding:'6px 10px', borderRadius:'var(--radius-sm)' }}>All INI Keys (Advanced)</div>
          <div className="scroll" style={{ maxHeight:360, padding:10, display:'grid', gap:8 }}>
            {(() => {
              // Collect all keys from parsed data
              const curatedSet = new Set(FIELDS.map(f=>`${f.iniFile}|${f.section}|${f.key}`));
              const entries: Array<{ file: string; section: string; key: string; value: any }> = [];
              const pushEntries = (file: string, data: IniData) => {
                Object.entries(data).forEach(([section, kv]) => {
                  Object.entries(kv).forEach(([key, value]) => {
                    const id = `${file}|${section}|${key}`;
                    if (!curatedSet.has(id)) entries.push({ file, section, key, value });
                  });
                });
              };
              pushEntries('GameUserSettings.ini', gameUserSettings);
              pushEntries('Game.ini', gameIni);
              const filtered = advancedFilter.trim() ? entries.filter(e => `${e.file} ${e.section} ${e.key}`.toLowerCase().includes(advancedFilter.toLowerCase())) : entries;
              if (filtered.length === 0) return <div style={{ fontSize:12, opacity:.6 }}>No keys match filter.</div>;
              return filtered.map(e => {
                const inferType = () => {
                  const v = String(e.value).trim();
                  if (v === 'True' || v === 'False' || v === 'true' || v === 'false') return 'boolean';
                  if (!isNaN(Number(v)) && v !== '') return 'number';
                  return 'string';
                };
                const t = inferType();
                const setAdvValue = (val: any) => {
                  if (e.file === 'GameUserSettings.ini') {
                    setGameUserSettings(g => ({ ...g, [e.section]: { ...(g[e.section]||{}), [e.key]: val } }));
                  } else {
                    setGameIni(g => ({ ...g, [e.section]: { ...(g[e.section]||{}), [e.key]: val } }));
                  }
                };
                const originalSource = e.file === 'GameUserSettings.ini' ? originalGameUserSettings : originalGameIni;
                const originalVal = originalSource[e.section]?.[e.key];
                const changed = String(originalVal) !== String(e.value);
                return (
                  <div key={`${e.file}|${e.section}|${e.key}`} style={{ border: changed ? '1px solid var(--bg-accent)' : '1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:8, background: changed ? 'rgba(14,99,156,0.25)' : 'var(--bg-alt)' }}>
                    <div style={{ fontSize:11, opacity:.7, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span>{e.file} / [{e.section}]</span>
                      {changed && <span style={{ fontSize:10, color:'#61dafb' }}>modified</span>}
                    </div>
                    <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <span style={{ fontSize:12, fontWeight:500 }}>{e.key}</span>
                      {t === 'boolean' && (
                        <input type="checkbox" checked={String(e.value).toLowerCase() === 'true'} onChange={(ev)=>setAdvValue(ev.target.checked ? 'True' : 'False')} />
                      )}
                      {t === 'number' && (
                        <input type="number" value={e.value} onChange={(ev)=>setAdvValue(ev.target.value)} />
                      )}
                      {t === 'string' && (
                        <input type="text" value={e.value} onChange={(ev)=>setAdvValue(ev.target.value)} />
                      )}
                      {changed && <small style={{ fontSize:10, opacity:.6 }}>Original: {String(originalVal ?? '(unset)')}</small>}
                    </label>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={saveAll} disabled={saving || loading}>Save INI Files</button>
        <button onClick={()=>loadFiles(workspaceRoot, selectedServerId)} disabled={loading}>Reload</button>
      </div>
      <pre style={{ marginTop:12, background:'#111', padding:8, borderRadius:4, fontSize:11, maxHeight:180, overflow:'auto' }}>{log}</pre>
    </section>
  );
}
