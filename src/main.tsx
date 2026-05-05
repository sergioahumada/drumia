import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

tf.setBackend('webgl');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
