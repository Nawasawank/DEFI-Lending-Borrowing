import Web3 from "web3";
import MultiPriceConsumerABI from '../src/contracts/MultiPriceConsumer.json';

//Connect directly to Ganache
const web3 = new Web3("http://127.0.0.1:9545");

const MultiPriceAddress = "0x0B635e0E51b574f2029f246424894F11cC25cD45";
const MultiPriceAbi = MultiPriceConsumerABI.abi;

export const MultiPriceContract = new web3.eth.Contract(
    MultiPriceAbi, MultiPriceAddress
);

export default web3;