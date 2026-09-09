local logger = require("logger")
local millennium = require("millennium")

local M = {}

M.DEFAULTS = {
	pollIntervalMs = 5000,
	playSound = false,
	tiers = {
		{ maxValue = 100, everyN = 1 },
		{ maxValue = 1000, everyN = 10 },
		{ maxValue = 10000, everyN = 100 },
		{ maxValue = 100000, everyN = 1000 },
	},
}

local CONFIG_KEY = "settings"

function M.load()
	local value, err = millennium.config.get(CONFIG_KEY)
	if err then
		logger:error("Failed to read config: " .. err)
	end

	if type(value) ~= "table" then
		return M.merge_defaults({})
	end

	return M.merge_defaults(value)
end

function M.save(settings)
	local success, err = millennium.config.set(CONFIG_KEY, settings)
	if not success then
		logger:error("Failed to write config: " .. (err or "unknown"))
		return false
	end

	return true
end

function M.merge_defaults(settings)
	local result = {}
	for k, v in pairs(M.DEFAULTS) do
		if settings[k] ~= nil then
			result[k] = settings[k]
		else
			result[k] = v
		end
	end
	return result
end

return M
