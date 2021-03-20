import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { createGlobalStyle } from 'styled-components'
import App from './App';
import reportWebVitals from './reportWebVitals';
import 'bootstrap/dist/css/bootstrap.min.css';

const GlobalStyle = createGlobalStyle`
  body {
    font-family: 'Roboto Mono';
    --primary: #009da0;
    --secondary: #868e96;
    --success: #0cc27e;
    --info: #1cbcd8;
    --danger: #ff586b;
    --dark: #343a40;
    --background: #f5f7fa; 
    background: var(--background);

    .only-mobile {
      display: none;
    }

    @media screen and (max-width: 450px) {
      .only-desktop {
        display: none;
      }
      .only-mobile {
        display: block;
      }
    }

  
  }

`

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
