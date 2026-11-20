/* Existing beach framing/ocean with a clay ice foreground and defense stripe. */
(function(root){'use strict';const node=typeof module!=='undefined'&&module.exports,Ocean=node?require('./rhythm-beach-ocean'):root.MoleGame.RhythmBeachOcean,Config=node?require('./pang-cannon-config'):root.MoleGame.PangCannonConfig;
 function frame(width,height,stageHeight){const scale=Math.max(width/1024,height/1536),offset=(height-1536*scale)/2,shore=offset+942*scale,horizon=Math.max(0,Math.min(shore-1,stageHeight*.37));return{width,height,horizon,shore};}
 function layout(aspect){const width=390,height=width/aspect,buttonWidth=(width-6-9)/4,buttons=buttonWidth*205/222+6,status=buttonWidth/1.55+5,dock=31+buttons+status+10,stageHeight=Math.max(height*.4,height-dock-56);return frame(width,height,stageHeight);}
 const ocean=Ocean.fragment.replace('#version 300 es','').replace('precision highp float;','').replace('uniform vec2 uSize;uniform float uTime;uniform vec3 uSun;out vec4 frag;','').replace(/void main\(\)\{\s*vec2 uv=vec2\(gl_FragCoord.x\/uSize.x,1.-gl_FragCoord.y\/uSize.y\);/,'vec4 beachOcean(vec2 uv,vec2 uSize,float uTime,vec3 uSun){').replace('frag=vec4(c,alpha);','return vec4(c,alpha);');
 const fragment=ocean+`
uniform vec4 beachFrame;
vec4 cannonIce(vec2 p,vec2 size,float shore){float t=(p.y-shore)/(size.y-shore),v=${Config.scene.iceEdgeV.toFixed(6)}+(1.-${Config.scene.iceEdgeV.toFixed(6)})*t;vec4 ice=texture(image,vec2(p.x/size.x,clamp(v,0.,1.)));return vec4(ice.rgb,smoothstep(0.,.97,ice.a));}
vec4 cannonBeachColor(){vec2 size=beachFrame.xy,p=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y);float horizon=beachFrame.z,shore=beachFrame.w;if(p.y<horizon){vec3 sky=mix(vec3(92.,165.,237.)/255.,vec3(166.,206.,239.)/255.,p.y/max(horizon,1.));float sun=.85*clamp(1.-length(p-vec2(size.x*.9,0.))/(size.x*.18),0.,1.);return vec4(mix(sky,vec3(1.,253./255.,233./255.),sun),1.);}vec4 water=beachOcean(vec2(p.x/size.x,clamp((p.y-horizon)/(shore-horizon),0.,1.)),vec2(size.x,shore-horizon),sceneTime,vec3(.819152,.573576,0.));vec3 waterColor=mix(vec3(166.,206.,239.)/255.,water.rgb,smoothstep(0.,5.,p.y-horizon));vec4 ice=cannonIce(p,size,shore);return vec4(mix(waterColor,ice.rgb,ice.a),1.);}

`;
 const api={frame,layout,fragment,defenseV:Config.scene.impactV};if(node)module.exports=api;else root.MoleGame.PangCannonBeach=api;
})(typeof window!=='undefined'?window:globalThis);
