function labels(instanceName, component) {
  return {
    'app.kubernetes.io/name': 'discord-bot',
    'app.kubernetes.io/component': component,
    'app.kubernetes.io/part-of': 'mineops',
    'app.kubernetes.io/managed-by': 'manifest',
    'app.kubernetes.io/instance': instanceName,
  };
}

function q(value) {
  return JSON.stringify(String(value));
}

export function generateDiscordManifest(instance, { image }) {
  const ns = instance.namespace;
  const nameLabels = labels(instance.name, 'chatops');
  const alertLabels = labels(instance.name, 'alert-history');
  return `apiVersion: v1
kind: ServiceAccount
metadata:
  name: discord-bot
  namespace: ${ns}
  labels: ${JSON.stringify(nameLabels)}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: discord-bot-readonly
  namespace: ${ns}
  labels: ${JSON.stringify(nameLabels)}
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "endpoints"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    resourceNames: ["minecraft"]
    verbs: ["patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments/scale"]
    resourceNames: ["minecraft"]
    verbs: ["get", "patch", "update"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list"]
  - apiGroups: ["batch"]
    resources: ["cronjobs"]
    resourceNames: ["minecraft-backup"]
    verbs: ["patch", "update"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["get", "create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: discord-bot-readonly
  namespace: ${ns}
  labels: ${JSON.stringify(nameLabels)}
subjects:
  - kind: ServiceAccount
    name: discord-bot
    namespace: ${ns}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: discord-bot-readonly
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: alert-history
  namespace: ${ns}
  labels: ${JSON.stringify(alertLabels)}
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: discord-bot
  namespace: ${ns}
  labels: ${JSON.stringify(nameLabels)}
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: discord-bot
    app.kubernetes.io/instance: ${q(instance.name)}
  ports:
    - name: http
      port: 8080
      targetPort: http
      protocol: TCP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: discord-bot
  namespace: ${ns}
  labels: ${JSON.stringify(nameLabels)}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: discord-bot
      app.kubernetes.io/instance: ${q(instance.name)}
  template:
    metadata:
      labels: ${JSON.stringify(nameLabels)}
    spec:
      serviceAccountName: discord-bot
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: discord-bot
          image: ${image}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          env:
            - { name: SERVICE_NAME, value: mineops-discord-bot }
            - { name: HTTP_PORT, value: "8080" }
            - { name: LOG_LEVEL, value: info }
            - name: TZ
              valueFrom: { configMapKeyRef: { name: mineops-runtime-config, key: MINEOPS_TIME_ZONE, optional: true } }
            - name: DISCORD_TOKEN
              valueFrom: { secretKeyRef: { name: discord-bot-secret, key: token } }
            - name: DISCORD_CLIENT_ID
              valueFrom: { secretKeyRef: { name: discord-bot-secret, key: client-id, optional: true } }
            - name: DISCORD_GUILD_ID
              valueFrom: { secretKeyRef: { name: discord-bot-secret, key: guild-id, optional: true } }
            - name: DISCORD_ALERT_CHANNEL_ID
              valueFrom: { secretKeyRef: { name: discord-bot-secret, key: alert-channel-id, optional: true } }
            - { name: DISCORD_REGISTER_COMMANDS, value: "true" }
            - { name: DISCORD_REQUIRED, value: "false" }
            - name: MINEOPS_NAMESPACE
              valueFrom: { fieldRef: { fieldPath: metadata.namespace } }
            - { name: MINECRAFT_DEPLOYMENT_NAME, value: minecraft }
            - { name: MINECRAFT_SERVICE_NAME, value: minecraft }
            - { name: MINECRAFT_LABEL_SELECTOR, value: ${q(`app.kubernetes.io/name=minecraft,app.kubernetes.io/instance=${instance.name}`)} }
            - { name: MINECRAFT_QUERY_HOST, value: minecraft-query }
            - { name: MINECRAFT_QUERY_PORT, value: "25565" }
            - { name: MINECRAFT_QUERY_TIMEOUT_MS, value: "2000" }
            - { name: PLAYIT_DEPLOYMENT_NAME, value: playit }
            - { name: PLAYIT_LABEL_SELECTOR, value: ${q(`app.kubernetes.io/name=playit,app.kubernetes.io/instance=${instance.name}`)} }
            - name: PLAYIT_JOIN_ADDRESS
              valueFrom: { configMapKeyRef: { name: mineops-runtime-config, key: PLAYIT_JOIN_ADDRESS, optional: true } }
            - { name: BACKUP_CRONJOB_NAME, value: minecraft-backup }
            - { name: BACKUP_LABEL_SELECTOR, value: ${q(`app.kubernetes.io/name=minecraft-backup,app.kubernetes.io/instance=${instance.name}`)} }
            - { name: MONITORING_ENABLED, value: "true" }
            - { name: MONITORING_INTERVAL_MS, value: "60000" }
            - { name: PVC_USAGE_WARNING_PERCENT, value: "80" }
            - { name: MINEOPS_ADMIN_CONFIG_PATH, value: /app/config/mineops-admins.json }
            - name: IDLE_SHUTDOWN_ENABLED
              valueFrom: { configMapKeyRef: { name: mineops-runtime-config, key: IDLE_SHUTDOWN_ENABLED, optional: true } }
            - name: IDLE_SHUTDOWN_MINUTES
              valueFrom: { configMapKeyRef: { name: mineops-runtime-config, key: IDLE_SHUTDOWN_MINUTES, optional: true } }
            - { name: LIFECYCLE_INTERVAL_MS, value: "60000" }
          volumeMounts:
            - { name: alert-history, mountPath: /app/data }
            - { name: admin-config, mountPath: /app/config, readOnly: true }
          resources:
            requests: { cpu: 50m, memory: 128Mi }
            limits: { cpu: 500m, memory: 512Mi }
          livenessProbe:
            httpGet: { path: /health, port: http }
            initialDelaySeconds: 10
            timeoutSeconds: 5
            periodSeconds: 20
            failureThreshold: 6
          readinessProbe:
            httpGet: { path: /ready, port: http }
            initialDelaySeconds: 10
            timeoutSeconds: 5
            periodSeconds: 20
            failureThreshold: 6
          securityContext:
            allowPrivilegeEscalation: false
            capabilities: { drop: ["ALL"] }
      volumes:
        - name: alert-history
          persistentVolumeClaim: { claimName: alert-history }
        - name: admin-config
          configMap: { name: mineops-admins, optional: true }
`;
}