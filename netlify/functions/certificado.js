const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const axios = require('axios');
const { admin, bucket } = require('./firebaseAdmin');

exports.handler = async (event, context) => {
    console.log('Handler iniciado');
    try {
        const userName = 'JOAO GUIRLHERMA SILVA BRAGA';

        if (!userName) {
            throw new Error('Nome do usuário não fornecido.');
        }

        console.log('Iniciando processamento para o usuário:', userName);

        // URL do arquivo PDF base
        const pdfUrl = 'https://drive.usercontent.google.com/u/0/uc?id=19Aht8l8dCpLyl9as9f52t97nZFuAJwEM&export=download';

        console.log('Baixando o conteúdo do arquivo PDF...');
        
        // Baixa o conteúdo do arquivo PDF
        const response = await axios.get(pdfUrl, {
            responseType: 'arraybuffer', // Define o tipo de resposta para arraybuffer
            timeout: 8000, // Limite de tempo de 8 segundos para o download
        });

        console.log('Conteúdo do PDF baixado com sucesso.');

        // Lê o conteúdo do PDF a partir do arraybuffer
        const existingPdfBytes = response.data;

        console.log('Carregando o documento PDF base...');

        // Carrega o documento PDF base
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        console.log('Documento PDF base carregado.');

        // Pega a primeira página do PDF base (ou ajuste conforme necessário)
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Define a fonte Helvetica
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Define o texto da assinatura
        const signatureText = userName;
        const fontSize = 8; // Ajuste o tamanho da fonte

        // Calcula a largura do texto para centralização
        const textWidth = helveticaFont.widthOfTextAtSize(signatureText, fontSize);
        const pageWidth = firstPage.getWidth();
        const pageHeight = firstPage.getHeight();

        // Coordenadas X e Y para centralizar o texto
        const x = (pageWidth - textWidth) / 2;
        const y = (pageHeight - fontSize) / 2; // Centralizado verticalmente

        // Adiciona o texto da assinatura na página
        firstPage.drawText(signatureText, {
            x: x,
            y: y,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0), // Cor preta
        });

        console.log('Texto da assinatura adicionado à página.');

        // Salva o PDF modificado como uma cópia
        const modifiedPdfBytes = await pdfDoc.save();

        console.log('PDF modificado salvo com sucesso.');

        // Nome do arquivo PDF no Firebase Storage
        const pdfFileName = `${userName.replace(/\s+/g, '_')}-certificado.pdf`;

        console.log('Enviando o PDF modificado para o Firebase Storage...');

        // Upload do PDF modificado para o Firebase Storage
        await bucket.file(`pdf/${pdfFileName}`).save(modifiedPdfBytes, {
            contentType: 'application/pdf',
            metadata: {
                metadata: {
                    firebaseStorageDownloadTokens: Date.now(),
                },
            },
        });

        console.log('PDF modificado enviado para o Firebase Storage.');

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'PDF modificado enviado para o Firebase Storage', fileName: pdfFileName }),
        };
    } catch (error) {
        console.error('Erro durante o processamento:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
