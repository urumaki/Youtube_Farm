"""Demo: testo 3D che ruota e scala, camera adattata al formato."""
import math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from common import setup_render, clear_scene, render

clear_scene()
s = setup_render()
vertical = s.render.resolution_y > s.render.resolution_x

bpy.ops.object.text_add()
t = bpy.context.object
t.data.body = os.environ.get("VF_TEXT", "Hello")
t.data.align_x, t.data.align_y = "CENTER", "CENTER"
t.data.extrude = 0.1
mat = bpy.data.materials.new("Glow"); mat.use_nodes = True
em = mat.node_tree.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = (0.1, 0.6, 1, 1); em.inputs["Strength"].default_value = 3
mat.node_tree.links.new(em.outputs[0], mat.node_tree.nodes["Material Output"].inputs[0])
t.data.materials.append(mat)

end = s.frame_end
t.rotation_euler = (math.radians(90), 0, 0); t.scale = (0.2,) * 3
t.keyframe_insert("rotation_euler", frame=1); t.keyframe_insert("scale", frame=1)
t.rotation_euler[2] = math.radians(360); t.scale = (1,) * 3
t.keyframe_insert("rotation_euler", frame=end); t.keyframe_insert("scale", frame=end // 3)

bpy.ops.object.camera_add(location=(0, -(14 if vertical else 8), 0), rotation=(math.radians(90), 0, 0))
s.camera = bpy.context.object
s.world = s.world or bpy.data.worlds.new("W")
s.world.color = (0.01, 0.01, 0.02)
render()
