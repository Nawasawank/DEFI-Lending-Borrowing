// import React, { useState, useEffect } from 'react';
// import web3, { MultiPriceContract } from '../web3.js';

// function MinimalTest() {
//   const [prices, setPrices] = useState({});
//   const [descriptions, setDescriptions] = useState({});
//   const [error, setError] = useState(null);

//   const tokens = ['ETH', 'BTC', 'USDC', 'DAI', 'GHO'];

//   useEffect(() => {
//     const fetchPricesAndDescriptions = async () => {
//       try {
//         const pricesData = {};
//         const descriptionsData = {};

//         for (const symbol of tokens) {
//           const priceRaw = await MultiPriceContract.methods.getPriceInUSD(symbol).call();
//           pricesData[symbol] = (parseFloat(priceRaw) / 100).toFixed(2);

//           const description = await MultiPriceContract.methods.getDescription(symbol).call();
//           descriptionsData[symbol] = description;
//         }

//         setPrices(pricesData);
//         setDescriptions(descriptionsData);
//       } catch (err) {
//         setError(err.message);
//       }
//     };

//     fetchPricesAndDescriptions();
//   }, []);

//   return (
//     <div>
//       {tokens.map((token) => (
//         <div key={token}>
//           <h3>{token} Price</h3>
//           <p>Price: {prices[token] ? `$${prices[token]}` : 'Loading...'}</p>
//           <p>Description: {descriptions[token] || 'Loading...'}</p>
//         </div>
//       ))}
//       {error && <p>Error: {error}</p>}
//     </div>
//   );
// }

// export default MinimalTest;
