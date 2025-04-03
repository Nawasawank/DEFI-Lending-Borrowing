// import React, { useState, useEffect } from 'react';
// import axios from 'axios';

// function MinimalTest() {
//   const [prices, setPrices] = useState({});
//   const [error, setError] = useState(null);

//   const tokens = ['ETH', 'BTC', 'USDC', 'DAI', 'GHO'];

//   useEffect(() => {
//     const fetchPrices = async () => {
//       try {
//         const pricesData = {};

//         for (const symbol of tokens) {
//           const response = await axios.get(`http://localhost:3001/api/price/${symbol}`);
//           pricesData[symbol] = (parseFloat(response.data.price) / 1e8).toFixed(2); // Adjust if needed
//         }

//         setPrices(pricesData);
//       } catch (err) {
//         setError(err.message);
//       }
//     };

//     fetchPrices();
//   }, []);

//   return (
//     <div>
//       <h2>Live Token Prices (via API)</h2>
//       {tokens.map((token) => (
//         <div key={token}>
//           <h3>{token}</h3>
//           <p>Price: {prices[token] ? `$${prices[token]}` : 'Loading...'}</p>
//         </div>
//       ))}
//       {error && <p style={{ color: 'red' }}>Error: {error}</p>}
//     </div>
//   );
// }

// export default MinimalTest;
