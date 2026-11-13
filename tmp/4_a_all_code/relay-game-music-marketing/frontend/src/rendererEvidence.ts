import type { AuraDiagnostics } from '@aura3d/engine';
import type { RenderOptions, RendererEvidence } from './types';

// Aura3D 4 exposes both legacy bridge reports and newer diagnostics sections.
// Keep this adapter narrow: absent execution evidence must never become success.
interface RuntimeReport {
  warnings?: readonly string[];
  renderer?: {
    bloom?: { rendered?: boolean };
    fog?: { enabled?: boolean };
    shadows?: { mapRendered?: boolean; mapSampled?: boolean; contactShadows?: number };
    runtime?: { mounted?: boolean; nativeInstancedSubmissions?: number };
    warnings?: readonly string[];
  };
  shadows?: { shadows?: readonly { sampled?: boolean }[] | null; droppedFeatures?: readonly string[] };
  post?: { present?: boolean; pixelBackedPasses?: readonly string[]; droppedPasses?: readonly string[]; missingInputs?: readonly string[] };
  effects?: { nodes?: readonly { effect: string; drawCalls?: number }[]; pixelBacked?: readonly string[]; errors?: readonly { code: string; message: string }[] };
}

export function collectRendererEvidence(diagnostics: AuraDiagnostics, options: RenderOptions, animatedAssets: number): RendererEvidence {
  const d=diagnostics as unknown as RuntimeReport,renderer=d.renderer;
  // The cascaded shadow path bypasses the legacy target-allocation counter.
  // Prefer its sampled report, including an explicit false, over the old flag.
  const shadowReports=d.shadows?.shadows;
  const sampled=Array.isArray(shadowReports)
    ? shadowReports.some(shadow=>shadow.sampled===true)
    : renderer?.shadows?.mapSampled===true;
  const rendered=Array.isArray(shadowReports) ? sampled : renderer?.shadows?.mapRendered===true;
  const bloom=renderer?.bloom?.rendered===true&&(d.post?.present&&d.post.pixelBackedPasses!==undefined
    ? d.post.pixelBackedPasses.includes('bloom')&&!d.post.droppedPasses?.includes('bloom')
    : true);
  const particles=d.effects?.pixelBacked?.includes('particles')===true
    && d.effects.nodes?.some(node=>node.effect==='particles'&&(node.drawCalls??0)>0)===true;
  const status=(requested:boolean,observed:boolean)=>!requested?'Off':observed?'Rendered':'Requested · unreported';
  return {
    bloom:status(options.bloom,bloom),
    fog:!options.fog?'Off':renderer?.fog?.enabled?'Enabled':'Requested · unreported',
    shadowMap:!options.shadows?'Off':sampled?'Sampled':status(true,rendered),
    grounding:!options.shadows?'Off':renderer?.runtime?.mounted&&(renderer.shadows?.contactShadows??0)>0?'Blob footprints':'Requested · unreported',
    particles:status(options.particles,particles),
    instancedSubmissions:renderer?.runtime?.nativeInstancedSubmissions??0,
    animatedAssets,
    limitations:[...new Set([
      ...(d.post?.droppedPasses??[]).map(pass=>`Postprocess pass unavailable: ${pass}`),
      ...(d.post?.missingInputs??[]).map(input=>`Missing postprocess input: ${input}`),
      ...(d.shadows?.droppedFeatures??[]).map(feature=>`Shadow feature unavailable: ${feature}`),
      ...(d.effects?.errors??[]).map(error=>`${error.code}: ${error.message}`),
    ])],
    warnings:[...new Set([...(d.warnings??[]),...(renderer?.warnings??[])])],
  };
}
