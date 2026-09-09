--[[
    Partial Achievement Notifications - Plugin Entry Point
]]

local logger = require("logger")
local millennium = require("millennium")
local json = require("json")
local settings = require("settings")

function GetSettings()
	local success, result = pcall(function()
		local current = settings.load()
		return json.encode({ success = true, data = current })
	end)

	if not success then
		logger:error("[PAN] GetSettings error: " .. tostring(result))
		return json.encode({ success = false, error = tostring(result) })
	end

	return result
end

function SaveSettings(settings_json)
	local success, result = pcall(function()
		local parsed = json.decode(settings_json)
		if type(parsed) ~= "table" then
			return json.encode({ success = false, error = "Invalid settings" })
		end

		local merged = settings.merge_defaults(parsed)
		local ok = settings.save(merged)
		if not ok then
			return json.encode({ success = false, error = "Failed to write settings file" })
		end

		return json.encode({ success = true })
	end)

	if not success then
		logger:error("[PAN] SaveSettings error: " .. tostring(result))
		return json.encode({ success = false, error = tostring(result) })
	end

	return result
end

local function on_load()
	logger:info("[PAN] plugin loaded, Millennium " .. millennium.version())
	millennium.ready()
end

local function on_unload()
	logger:info("[PAN] plugin unloaded")
end

return {
	on_load = on_load,
	on_unload = on_unload,
	GetSettings = GetSettings,
	SaveSettings = SaveSettings,
}
