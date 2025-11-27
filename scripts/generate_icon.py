import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_icon():
    size = (512, 512)
    # Background: Dark Blue #0b1c2c
    img = Image.new('RGBA', size, color='#0b1c2c')
    draw = ImageDraw.Draw(img)
    
    # Grid #3BC9DB opacity 0.1
    grid_color = (59, 201, 219, 30)
    for i in range(0, 512, 64):
        draw.line([(i, 0), (i, 512)], fill=grid_color, width=1)
        draw.line([(0, i), (512, i)], fill=grid_color, width=1)
        
    # Tech Borders
    border_color = '#3BC9DB'
    w = 10
    # Corners
    draw.line([(20, 20), (150, 20)], fill=border_color, width=w)
    draw.line([(20, 20), (20, 150)], fill=border_color, width=w)
    
    draw.line([(362, 20), (492, 20)], fill=border_color, width=w)
    draw.line([(492, 20), (492, 150)], fill=border_color, width=w)
    
    draw.line([(20, 492), (150, 492)], fill=border_color, width=w)
    draw.line([(20, 492), (20, 362)], fill=border_color, width=w)
    
    draw.line([(362, 492), (492, 492)], fill=border_color, width=w)
    draw.line([(492, 492), (492, 362)], fill=border_color, width=w)

    # Text "ASN.1"
    # Use default font or load arial if possible. Windows has Arial.
    try:
        font_sm = ImageFont.truetype("arial.ttf", 80)
        font_lg = ImageFont.truetype("arialbd.ttf", 250)
    except IOError:
        font_sm = ImageFont.load_default()
        font_lg = ImageFont.load_default()

    # Draw "ASN.1"
    text = "ASN.1"
    # Centered top
    try:
        draw.text((256, 120), text, font=font_sm, fill='#3BC9DB', anchor="mm")
    except:
        # Fallback for older PIL
        bbox = draw.textbbox((0, 0), text, font=font_sm)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((512-w)/2, 120-h/2), text, font=font_sm, fill='#3BC9DB')

    # Draw "X"
    text_x = "X"
    color_x = '#FFD43B'
    
    x_layer = Image.new('RGBA', size, (0,0,0,0))
    x_draw = ImageDraw.Draw(x_layer)
    
    try:
        x_draw.text((256, 300), text_x, font=font_lg, fill=color_x, anchor="mm")
    except:
        bbox = x_draw.textbbox((0, 0), text_x, font=font_lg)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x_draw.text(((512-w)/2, 300-h/2), text_x, font=font_lg, fill=color_x)
        
    # Blur for glow
    glow = x_layer.filter(ImageFilter.GaussianBlur(10))
    img.paste(glow, (0,0), glow)
    img.paste(x_layer, (0,0), x_layer)

    # Save
    build_dir = os.path.join('frontend', 'build')
    if not os.path.exists(build_dir):
        os.makedirs(build_dir)
        
    icon_path = os.path.join(build_dir, 'icon.ico')
    png_path = os.path.join(build_dir, 'icon.png')
    
    # Save as ICO (sizes 16, 32, 48, 64, 128, 256)
    img.save(icon_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    img.save(png_path, format='PNG')
    print(f"Icons generated: {icon_path}, {png_path}")

if __name__ == '__main__':
    create_icon()
