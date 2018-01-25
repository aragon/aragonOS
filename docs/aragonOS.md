# aragonOS 3.0 alpha, developer documentation

*Documentation for [aragonOS](https://github.com/aragon/aragonOS) 3.0.0 reference implementation.
Updated Jan. 25th, 2018.*

This document provides a technical overview about the architecture. For a less
technically-oriented introduction to aragonOS 3.0, you can check the [alpha release blog post]().

## 1. General architecture, Kernel and apps

## 2. Kernel
### 2.1 The app mapping
### 2.2 Namespaces

## 3. Upgradeability
### 3.1 DelegateProxies
### 3.2 Kernel upgradeability
### 3.3 AppProxies and upgradeability

## 4. ACL
### 4.1 The ACL as an Aragon app, the Interface
### 4.2 Basic ACL
### 4.3 Permission managers
### 4.4 Parameter interpretation
### 4.5 Examples of rules

## 5. Forwarders and EVMScript
### 5.1 Forwarding and transaction pathing
### 5.2 EVMScripts
#### 5.2.1 Warnings
#### 5.2.2 Script executors
##### 5.2.2.1 CallScript
##### 5.2.2.1 DelegateScript
##### 5.2.2.3 DeployDelegateScript

## 6. The Aragon Package Manager
### 6.1 APM as an Aragon DAO
### 6.2 APMRegistry
#### 6.2.1 ENSSubdomainRegistrar
#### 6.2.2 APMRegistry governance
### 6.3 Repos
#### 6.3.1 New version rules

## 7. Aragon app development guide
### 7.1 Using the ACL
### 7.2 Upgradeability: storage considerations
### 7.3 Testing and publishing your app with aragon-dev-cli
