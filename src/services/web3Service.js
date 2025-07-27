// src/services/web3Service.js
const { ethers } = require('ethers');
const contractABI = require('../../contracts/abi/CryptoMembershipNFT.json');

class Web3Service {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.contract = new ethers.Contract(
      this.contractAddress,
      contractABI,
      this.provider
    );
  }

  // ดึงข้อมูล member จาก contract
  async getMemberInfo(walletAddress) {
    try {
      const member = await this.contract.members(walletAddress);
      const tokenBalance = await this.contract.balanceOf(walletAddress);
      
      if (tokenBalance.toString() === '0') {
        return null;
      }

      return {
        upline: member.upline,
        totalReferrals: member.totalReferrals.toString(),
        totalEarnings: member.totalEarnings.toString(),
        planId: member.planId.toString(),
        cycleNumber: member.cycleNumber.toString(),
        registeredAt: new Date(Number(member.registeredAt) * 1000)
      };
    } catch (error) {
      console.error('Error getting member info:', error);
      throw error;
    }
  }

  // ดึงข้อมูล plan
  async getPlanInfo(planId) {
    try {
      const plan = await this.contract.getPlanInfo(planId);
      return {
        price: plan.price.toString(),
        name: plan.name,
        membersPerCycle: plan.membersPerCycle.toString(),
        isActive: plan.isActive,
        imageURI: plan.imageURI
      };
    } catch (error) {
      console.error('Error getting plan info:', error);
      throw error;
    }
  }

  // ดึงข้อมูล cycle
  async getPlanCycleInfo(planId) {
    try {
      const cycleInfo = await this.contract.getPlanCycleInfo(planId);
      return {
        currentCycle: cycleInfo.currentCycle.toString(),
        membersInCurrentCycle: cycleInfo.membersInCurrentCycle.toString(),
        membersPerCycle: cycleInfo.membersPerCycle.toString()
      };
    } catch (error) {
      console.error('Error getting cycle info:', error);
      throw error;
    }
  }

  // ดึงสถิติระบบ
  async getSystemStats() {
    try {
      const stats = await this.contract.getSystemStats();
      return {
        totalMembers: stats.totalMembers.toString(),
        totalRevenue: stats.totalRevenue.toString(),
        totalCommission: stats.totalCommission.toString(),
        ownerFunds: stats.ownerFunds.toString(),
        feeFunds: stats.feeFunds.toString(),
        fundFunds: stats.fundFunds.toString()
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw error;
    }
  }

  // ดึง NFT metadata
  async getNFTImage(tokenId) {
    try {
      const nftData = await this.contract.getNFTImage(tokenId);
      return {
        imageURI: nftData.imageURI,
        name: nftData.name,
        description: nftData.description,
        planId: nftData.planId.toString(),
        createdAt: new Date(Number(nftData.createdAt) * 1000)
      };
    } catch (error) {
      console.error('Error getting NFT image:', error);
      throw error;
    }
  }
}

module.exports = new Web3Service();