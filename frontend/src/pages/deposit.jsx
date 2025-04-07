import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Deposit = () => {
  const [account, setAccount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [networkId, setNetworkId] = useState(null);
  const [waitingForNetwork, setWaitingForNetwork] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(true);

  // Available assets from your controller
  const assets = [
    { address: '0x6737814d44B5BA63680A57ea157f424419e11CF7', symbol: 'WETH' },
    { address: '0xd29d42D7E8171C3129f572Bb0334d7FBa65a4Fc2', symbol: 'WBTC' },
    { address: '0x79276a9Ac4B539651E17D3BD55674AA4691EfE1F', symbol: 'USDC' },
    { address: '0xad34fB69BB3c1417e762d933B1cc8d964Aaf933c', symbol: 'DAI' },
    { address: '0xe9D6fFB1f7660798a2223043f0fa23a540055AD4', symbol: 'GHO' },
  ];

  // Check if MetaMask is installed and listen for network changes
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      setIsMetaMaskInstalled(true);
      
      // Listen for network changes
      window.ethereum.on('chainChanged', (chainId) => {
        console.log('Network changed to:', parseInt(chainId, 16));
        setNetworkId(parseInt(chainId, 16));
        // Reset account when network changes
        setAccount('');
        setMessage('');
        setError('');
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Account changed to:', accounts[0]);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          // If an asset is already selected, fetch the balance for the new account
          if (selectedAsset) {
            fetchBalance(accounts[0], selectedAsset);
          }
        } else {
          setAccount('');
        }
      });

      // Check initial network
      window.ethereum.request({ method: 'eth_chainId' })
        .then(chainId => {
          setNetworkId(parseInt(chainId, 16));
        })
        .catch(error => {
          console.error('Error getting network ID:', error);
        });
        
      // Check if already connected
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          }
        })
        .catch(error => {
          console.error('Error checking accounts:', error);
        });
    } else {
      setIsMetaMaskInstalled(false);
    }

    return () => {
      // Clean up listeners
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('chainChanged', () => {});
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, [selectedAsset]);

  // Check if connected to Ganache (network ID 1337)
  const isGanacheNetwork = networkId === 1337 || networkId === 5777;

  const connectWallet = async () => {
    try {
      setError('');
      setWaitingForNetwork(false);
      setMessage('Connecting wallet...');
      
      if (!isMetaMaskInstalled) {
        setError('MetaMask is not installed. Please install MetaMask to use this app.');
        setMessage('');
        return;
      }

      // First check network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentNetworkId = parseInt(chainId, 16);
      setNetworkId(currentNetworkId);

      if (!isGanacheNetwork) {
        setError('Please connect to Ganache (localhost:3000) in MetaMask.');
        setWaitingForNetwork(true);
        setMessage('');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        setError('No accounts found. Please connect your wallet.');
        setMessage('');
        return;
      }

      setAccount(accounts[0]);
      setMessage('Wallet connected successfully to Ganache!');
      setWaitingForNetwork(false);
      
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet');
      setMessage('');
    }
  };

  const handleAssetChange = async (e) => {
    const assetAddress = e.target.value;
    setSelectedAsset(assetAddress);
    
    if (account && assetAddress) {
      fetchBalance(account, assetAddress);
    }
  };

  const fetchBalance = async (userAddress, assetAddress) => {
    try {
      setIsLoading(true);
      // Using the correct endpoint for balance
      const response = await axios.post('http://localhost:3001/api/balance', {
        userAddress,
        assetAddress
      });
      
      setBalance(response.data.balance);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setIsLoading(false);
      setBalance('Error');
    }
  };

  const handleDeposit = async () => {
    try {
      setIsLoading(true);
      setError('');
      setMessage('Processing deposit...');
      
      if (!account) {
        setError('Please connect your wallet first');
        setMessage('');
        setIsLoading(false);
        return;
      }

      if (!isGanacheNetwork) {
        setError('Please connect to Ganache network before depositing.');
        setMessage('');
        setIsLoading(false);
        return;
      }

      if (!selectedAsset) {
        setError('Please select an asset');
        setMessage('');
        setIsLoading(false);
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount');
        setMessage('');
        setIsLoading(false);
        return;
      }

      // Make deposit request with the correct format
      const response = await axios.post('http://localhost:3001/api/deposit', {
        fromAddress: account,
        assetAddress: selectedAsset,
        amount: amount
      });

      console.log('Deposit response:', response.data);
      setMessage(`Deposit successful! Transaction hash: ${response.data.transactionHash}`);
      
      // Refresh balance after successful deposit
      fetchBalance(account, selectedAsset);
      setAmount('');
      setIsLoading(false);
    } catch (error) {
      console.error('Error during deposit:', error);
      let errorMessage = 'Deposit failed';
      
      if (error.response && error.response.data) {
        if (error.response.data.error) {
          errorMessage = error.response.data.error;
          
          if (error.response.data.suggestion) {
            errorMessage += ': ' + error.response.data.suggestion;
          }
        }
      }
      
      setError(errorMessage);
      setMessage('');
      setIsLoading(false);
    }
  };

  // Refresh balance when account or selected asset changes
  useEffect(() => {
    if (account && selectedAsset) {
      fetchBalance(account, selectedAsset);
    }
  }, [account, selectedAsset]);

  // Switch to Ganache network
  const switchToGanache = async () => {
    try {
      setMessage('Switching to Ganache network...');
      
      // Try to switch to Ganache
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x539' }], // Chain ID 1337 in hex
      });
      
      setMessage('Successfully switched to Ganache network!');
      setTimeout(() => {
        setMessage('');
        connectWallet();
      }, 2000);
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x539', // 1337 in hex
                chainName: 'Ganache Local',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['http://localhost:8545'],
              },
            ],
          });
          
          connectWallet();
        } catch (addError) {
          setError('Failed to add Ganache network to MetaMask');
        }
      } else {
        setError(switchError.message || 'Failed to switch network');
      }
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>DeFi Lending Deposit</h1>
      
      {!isMetaMaskInstalled ? (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#fed7d7', 
          color: '#9b2c2c', 
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <p>MetaMask is not installed. Please install MetaMask to use this app.</p>
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#4299e1',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none'
            }}
          >
            Install MetaMask
          </a>
        </div>
      ) : waitingForNetwork ? (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#feebc8', 
            color: '#9c4221', 
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            <p>Please connect to Ganache network in MetaMask to continue.</p>
          </div>
          <button 
            onClick={switchToGanache}
            style={{
              width: '100%',
              backgroundColor: '#ed8936',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Switch to Ganache Network
          </button>
        </div>
      ) : !account ? (
        <button 
          onClick={connectWallet}
          style={{
            width: '100%',
            backgroundColor: '#4299e1',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          Connect Wallet
        </button>
      ) : (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f7fafc', 
          borderRadius: '5px' 
        }}>
          <p style={{ color: '#718096', fontSize: '14px' }}>Connected Account</p>
          <p style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{account}</p>
          {networkId && (
            <p style={{ 
              marginTop: '10px', 
              padding: '5px 10px', 
              backgroundColor: isGanacheNetwork ? '#c6f6d5' : '#fed7d7',
              color: isGanacheNetwork ? '#276749' : '#9b2c2c',
              borderRadius: '4px',
              display: 'inline-block',
              fontSize: '12px'
            }}>
              {isGanacheNetwork ? '✓ Connected to Ganache' : '⚠ Not connected to Ganache'}
            </p>
          )}
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#4a5568' }}>
          Select Asset
        </label>
        <select 
          value={selectedAsset}
          onChange={handleAssetChange}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #e2e8f0',
            borderRadius: '5px'
          }}
          disabled={!account || !isGanacheNetwork}
        >
          <option value="">Select an asset</option>
          {assets.map((asset) => (
            <option key={asset.address} value={asset.address}>
              {asset.symbol}
            </option>
          ))}
        </select>
      </div>
      
      {selectedAsset && account && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f7fafc', 
          borderRadius: '5px' 
        }}>
          <p style={{ color: '#718096', fontSize: '14px' }}>Your Deposit Balance</p>
          <p style={{ fontWeight: 'bold' }}>
            {isLoading ? 'Loading...' : `${balance} ${assets.find(a => a.address === selectedAsset)?.symbol || ''}`}
          </p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#4a5568' }}>
          Amount to Deposit
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #e2e8f0',
            borderRadius: '5px'
          }}
          disabled={!account || !selectedAsset || !isGanacheNetwork}
        />
      </div>
      
      <button
        onClick={handleDeposit}
        disabled={!account || !selectedAsset || !amount || isLoading || !isGanacheNetwork}
        style={{
          width: '100%',
          backgroundColor: isLoading || !account || !selectedAsset || !amount || !isGanacheNetwork ? '#cbd5e0' : '#48bb78',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          border: 'none',
          cursor: isLoading || !account || !selectedAsset || !amount || !isGanacheNetwork ? 'not-allowed' : 'pointer'
        }}
      >
        {isLoading ? 'Processing...' : 'Deposit'}
      </button>
      
      {message && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#c6f6d5', 
          color: '#276749', 
          borderRadius: '5px' 
        }}>
          {message}
        </div>
      )}
      
      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fed7d7', 
          color: '#9b2c2c', 
          borderRadius: '5px' 
        }}>
          {error}
        </div>
      )}

      <div style={{ 
        marginTop: '30px', 
        fontSize: '14px', 
        color: '#718096' 
      }}>
        <p style={{ marginBottom: '8px' }}>
          <strong>Note:</strong> If you don't have enough tokens, the system will try to get some from the faucet automatically.
        </p>
        <p>Make sure your wallet is connected to the Ganache network.</p>
      </div>
    </div>
  );
};

export default Deposit;