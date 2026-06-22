variable "kubeconfig_path" {
  description = "Path to the kubeconfig file for the target MineOps Kubernetes cluster."
  type        = string
  default     = "~/.kube/config"
}

variable "namespace" {
  description = "Kubernetes namespace reserved for MineOps platform resources."
  type        = string
  default     = "mineops"
}
