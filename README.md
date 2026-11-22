REVORA PRO — Porsche 911 GT3 RS 3D Model Integration

This version replaces the original procedural Three.js car with the Sketchfab-hosted
Porsche 911 GT3 RS (992) '23 model used in the prior REVORA_GT3RS_3D viewer.

Model:
- Creator: Mona x Supercars
- Sketchfab model UID: 99c74d8fa7df42d984903868f6e593f6
- License: Creative Commons Attribution (CC BY 4.0)
- Source: https://sketchfab.com/3d-models/porsche-911-gt3-rs-992-23-99c74d8fa7df42d984903868f6e593f6

Files:
- index.html
- style.css
- script.js

Deployment:
Upload all three files to the same folder in your GitHub repository, then deploy
with GitHub Pages. The model and Sketchfab Viewer API require an internet connection.

Testing:
- JavaScript syntax checked with Node.
- Checked script-referenced HTML IDs (no missing IDs).
- Checked that configurator controls and model UID are present.
- The live Sketchfab viewer/material/node behavior could not be browser-tested here.
  Sketchfab's viewer API can edit materials and node visibility/transforms, but
  exact customization support depends on the model's material/node names and structure.
  This integration attempts best-effort matching; wheel geometry/spoke design may not
  be changeable through an embed. A downloadable GLB with editable named parts is
  required for guaranteed full customization.
