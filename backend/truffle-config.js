module.exports = {
  networks: {
    ganache: {
      host: "127.0.0.1",
      port: 7545, 
      network_id: "5777",
    },
    ganache_fork: {
      host: "127.0.0.1",
      port: 9545, 
      network_id: "11155111",
    }
    
  },
  compilers: {
    solc: {
      version: "0.8.0"
}
  }
};
