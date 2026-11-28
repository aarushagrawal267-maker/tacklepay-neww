# TacketPay public demo on Hugging Face Spaces (Docker SDK, free CPU hardware).
# The Space repository is this project with this file and deploy/huggingface/README.md copied to its root
# (see "Deploying" in the main README). Everything stays demo money.
FROM node:24-bookworm-slim

# Free Spaces have no persistent disk, so the TPI books live in the container and reset when it restarts.
#   NEXT_PUBLIC_TPI_PUBLIC_DEMO  opens Diya and Aarush on start and says on the welcome screen that data resets
#   TPI_FRAME_ANCESTORS          lets the Space page on huggingface.co show the app in its iframe
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_TPI_PUBLIC_DEMO=1 \
    TPI_FRAME_ANCESTORS=https://huggingface.co \
    TPI_DB_PATH=/home/node/app/data/tpi.db \
    HOSTNAME=0.0.0.0 \
    PORT=7860

# Spaces run the container as user 1000, which is `node` in this image.
RUN mkdir -p /home/node/app && chown node:node /home/node/app
USER node
WORKDIR /home/node/app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .
RUN npm run build

EXPOSE 7860
CMD ["npm", "start", "--", "--hostname", "0.0.0.0", "--port", "7860"]
