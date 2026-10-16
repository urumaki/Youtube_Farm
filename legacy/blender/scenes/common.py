"""Helper bpy condivisi: legge i parametri VF_* e configura il render H.264."""
import os
import bpy

def setup_render():
    s = bpy.context.scene
    w, h, fps = int(os.environ["VF_WIDTH"]), int(os.environ["VF_HEIGHT"]), int(os.environ["VF_FPS"])
    s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = w, h, 100
    s.render.fps = fps
    s.frame_start, s.frame_end = 1, int(float(os.environ["VF_SECONDS"]) * fps)
    s.render.engine = "BLENDER_EEVEE_NEXT" if bpy.app.version >= (4, 2, 0) else "BLENDER_EEVEE"
    s.render.image_settings.file_format = "FFMPEG"
    s.render.ffmpeg.format, s.render.ffmpeg.codec = "MPEG4", "H264"
    s.render.ffmpeg.constant_rate_factor = "HIGH"
    s.render.filepath = os.environ["VF_OUT"]
    return s

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

def render():
    bpy.ops.render.render(animation=True)
