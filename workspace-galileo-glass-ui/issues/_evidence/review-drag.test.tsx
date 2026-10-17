import React from 'react';
import { renderHook, render, cleanup } from '@testing-library/react';
import { useDraggableListPhysics } from './src/hooks/useDraggableListPhysics';
import { GlassDataGrid } from './src/components/GlassDataGrid/GlassDataGrid';
const mockEngine = {addBody:jest.fn(()=>'body-1'),removeBody:jest.fn()};
jest.mock('./src/animations/physics', () => ({
  useGalileoPhysicsEngine: () => mockEngine,
  useVectorSpring: () => ({value:{x:0,y:0,z:0},start:jest.fn()}),
}));
jest.mock('./src/components/surfaces/DimensionalGlass', () => ({__esModule:true,default:({children}:any)=><div>{children}</div>}));
beforeEach(() => {
  jest.clearAllMocks();
  global.requestAnimationFrame = jest.fn(()=>1);
  global.cancelAnimationFrame = jest.fn();
});
afterEach(cleanup);
test('StrictMode cleanup removes bodies but second setup does not recreate them', () => {
  const element = document.createElement('div');
  Object.defineProperties(element,{offsetWidth:{value:100},offsetHeight:{value:50}});
  const refs = [{current:element}];
  const hook = renderHook(()=>useDraggableListPhysics({itemRefs:refs}),{wrapper:({children}:any)=><React.StrictMode>{children}</React.StrictMode>});
  expect(mockEngine.addBody).toHaveBeenCalledTimes(1);
  expect(mockEngine.removeBody).toHaveBeenCalledTimes(1);
  hook.unmount();
});
test('Grid applies absolute drag layout even when row dragging is disabled', () => {
  const warn=jest.spyOn(console,'warn').mockImplementation(()=>{});
  try {
    const view=render(<GlassDataGrid data={[{id:1,name:'Alice'}]} columns={[{id:'name',header:'Name',accessorKey:'name'}]} enableRowDragging={false}/>);
    const row=view.container.querySelector('tbody tr') as HTMLElement;
    expect(row.style.position).toBe('absolute');
    expect(row.style.userSelect).toBe('none');
  } finally {warn.mockRestore();}
});
