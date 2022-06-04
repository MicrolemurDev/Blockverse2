export const PLATFORM = 'WEBGL2';
export const SHADER_TYPE = 'VERTEX';
export const SOURCE = `#version 300 es
precision highp float;

in vec3  aVertex; // Block Position?
in vec2  aTexture; // Texture Atlas Coords
in float aShadow; // Shadow Level for Voxel
in float aLightValue; // Light Value to Multiply for the Block
   
out vec2  vTexture; // Texture Atlas Coords
out float vShadow; // Shadow after Calculation
out float  vFog; // Fog Level
out float vLightValue; // Once again, the light level to multiply
    
uniform mat4  uView; // ???
uniform float uDist; // Frustrum Culling???
uniform vec3  uPos; // ???

void main() {
	vTexture = aTexture;
  vLightValue = aLightValue;
	vShadow = aShadow > 0.0 ? aShadow : 1.0; // Shadow calculation
	gl_Position = uView * vec4( aVertex, 1.0);

	float range = max(uDist / 5.0, 8.0); 
	vFog = clamp((length(uPos.xz - aVertex.xz) - uDist + range) / range, 0.0, 1.0);
}`;