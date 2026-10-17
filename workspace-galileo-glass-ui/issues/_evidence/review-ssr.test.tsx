/** @jest-environment node */
import React from 'react';
import {renderToString} from 'react-dom/server';
import {Modal} from './src/components/Modal/Modal';
jest.mock('./src/hooks/useReducedMotion',()=>({useReducedMotion:()=>false}));
jest.mock('./src/contexts/AnimationContext',()=>({useAnimationContext:()=>({defaultSpring:'DEFAULT'})}));
test('Even a closed modal throws document is not defined during server rendering',()=>{
  expect(()=>renderToString(<Modal open={false}><span>body</span></Modal>)).toThrow('document is not defined');
});
