local textureId = "6403436082"

function applyTexture(part)
    local sides = {"Front", "Back", "Top", "Bottom", "Left", "Right"}
    for _, side in ipairs(sides) do
        local surfaceGui = Instance.new("SurfaceGui", part)
        surfaceGui.Face = Enum.NormalId[side]
        local imageLabel = Instance.new("ImageLabel", surfaceGui)
        imageLabel.Size = UDim2.new(1, 0, 1, 0)
        imageLabel.Image = textureId
        imageLabel.BackgroundTransparency = 1
    end
end

function replaceTextures()
    for _, part in pairs(game.Workspace:GetDescendants()) do
        if part:IsA("BasePart") then
            applyTexture(part)
        end
    end
end

replaceTextures()
