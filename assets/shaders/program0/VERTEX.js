export const PLATFORM = 'WEBGL2';
export const SHADER_TYPE = 'VERTEX';
export const SOURCE = `#version 300 es
precision highp float;

in vec3  aVertex;
in vec2  aTexture;
in float aShadow;
   
out vec2  vTexture;
out float vShadow;
out float  vFog; // Why was this changed?
out vec3  vFogColor;
    
uniform mat4  uView;
uniform float uDist;
uniform vec3  uPos;
uniform vec3  uFogColor;

void main() {
	vTexture = aTexture;
	vShadow = aShadow > 0.0 ? aShadow : 1.0; // Shadow calculation
	gl_Position = uView * vec4( aVertex, 1.0);

	float range = max(uDist / 5.0, 8.0); 
	vFog = clamp((length(uPos.xz - aVertex.xz) - uDist + range) / range, 0.0, 1.0); // This code makes an error.
  vFogColor = uFogColor;
}`;