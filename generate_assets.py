from PIL import Image, ImageDraw, ImageFont
import os

# Set working directory to this file's folder
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Create directories if needed
os.makedirs('build', exist_ok=True)
os.makedirs('renderer', exist_ok=True)

# 1. GENERATE ICON (Super-sampled 1024x1024 -> 256x256)
size = 1024
icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(icon)

# Draw rounded rectangle gradient background
for y in range(size):
    # Gradient from forest green #0c3825 to vibrant emerald #198754
    r = int(12 + (25 - 12) * y / size)
    g = int(56 + (135 - 56) * y / size)
    b = int(37 + (84 - 37) * y / size)
    draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

# Create a rounded corner mask
mask = Image.new("L", (size, size), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([(20, 20), (size-20, size-20)], radius=180, fill=255)

# Apply mask to gradient
icon = Image.composite(icon, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask)
draw = ImageDraw.Draw(icon)

# Draw the 3 stacked layers (feather style layers)
thickness = 26
color_white = (255, 255, 255, 255)

# Helper to draw thick connected lines with rounded corners
def draw_thick_line(points, width):
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=color_white, width=width)
        # Draw circles at vertices to round corners
        draw.ellipse([points[i][0]-width//2, points[i][1]-width//2, points[i][0]+width//2, points[i][1]+width//2], fill=color_white)
    draw.ellipse([points[-1][0]-width//2, points[-1][1]-width//2, points[-1][0]+width//2, points[-1][1]+width//2], fill=color_white)

# Top layer (complete diamond)
draw_thick_line([(512, 240), (800, 384), (512, 528), (224, 384), (512, 240)], thickness)

# Middle layer (only bottom sides)
draw_thick_line([(224, 504), (512, 648), (800, 504)], thickness)

# Bottom layer (only bottom sides)
draw_thick_line([(224, 624), (512, 768), (800, 624)], thickness)

# Resize to 256x256
icon_256 = icon.resize((256, 256), Image.Resampling.LANCZOS)
icon_256.save("icon.png")
icon_256.save("icon.ico", format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
icon_256.save("build/icon.ico", format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("Icons generated successfully!")

# 2. GENERATE SPLASH SCREEN (600x400)
splash = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
splash_draw = ImageDraw.Draw(splash)

# Gradient background
for y in range(400):
    # From deep forest green #0a2d1e to dark green #08432a
    r = int(10 + (8 - 10) * y / 400)
    g = int(45 + (67 - 45) * y / 400)
    b = int(30 + (42 - 30) * y / 400)
    splash_draw.line([(0, y), (600, y)], fill=(r, g, b, 255))

# Create a rounded corner mask for splash window
s_mask = Image.new("L", (600, 400), 0)
s_mask_draw = ImageDraw.Draw(s_mask)
s_mask_draw.rounded_rectangle([(0, 0), (600, 400)], radius=12, fill=255)
splash = Image.composite(splash, Image.new("RGBA", (600, 400), (0, 0, 0, 0)), s_mask)
splash_draw = ImageDraw.Draw(splash)

# Draw mini logo on splash (scaled to fit)
mini_logo = icon.resize((130, 130), Image.Resampling.LANCZOS)
splash.paste(mini_logo, (300 - 65, 55), mini_logo)

# Load fonts
try:
    font_title = ImageFont.truetype("arial.ttf", 34)
    font_subtitle = ImageFont.truetype("arial.ttf", 16)
    font_meta = ImageFont.truetype("arial.ttf", 12)
except IOError:
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()
    font_meta = ImageFont.load_default()

# Draw title (centered)
title_text = "Agritech LIMS"
title_w = splash_draw.textlength(title_text, font=font_title)
splash_draw.text((300 - title_w/2, 205), title_text, fill=(255, 255, 255, 255), font=font_title)

# Draw subtitle (centered)
subtitle_text = "Agricultural Research & Laboratory Suite"
sub_w = splash_draw.textlength(subtitle_text, font=font_subtitle)
splash_draw.text((300 - sub_w/2, 255), subtitle_text, fill=(32, 201, 151, 255), font=font_subtitle)

# Draw version (centered)
version_text = "Research Suite v1.0.0"
ver_w = splash_draw.textlength(version_text, font=font_meta)
splash_draw.text((300 - ver_w/2, 285), version_text, fill=(180, 180, 180, 255), font=font_meta)

splash.save("renderer/splash.png")
print("Splash screen background generated successfully!")
